require('dotenv').config();
const reloadCommand = require('./reloadCommands.js');
const contributeCommand = require('./contributeCommand.js');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { findAllMatchedKeywords, promptAndDelete } = require('./utils.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const channelKeywordSources = {
  [process.env.HK_CHANNEL]: 'https://raw.githubusercontent.com/Zaliant1/help-bot-keywords/refs/heads/main/hk-words.json', // HK
};

const keywordMap = new Map();
const commands = new Map();
commands.set(reloadCommand.name, reloadCommand);
commands.set(contributeCommand.name, contributeCommand);

const fetchKeywords = async (url) => {
  const extractKeywordsFromJson = (data) => {
    let result = [];

    if (typeof data === 'string') {
      result.push(data.trim());
    } else if (Array.isArray(data)) {
      for (const item of data) {
        result = result.concat(extractKeywordsFromJson(item));
      }
    } else if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        result = result.concat(extractKeywordsFromJson(data[key]));
      }
    }

    return [...new Set(result.filter(Boolean))];
  };

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const json = await res.json();
    return extractKeywordsFromJson(json);
  } catch (err) {
    console.error(`❌ Error fetching keywords from ${url}:`, err.message);
    return [];
  }
};

async function loadKeywords() {
  for (const [channelId, url] of Object.entries(channelKeywordSources)) {
    const keywords = await fetchKeywords(url);
    keywordMap.set(channelId, keywords);
    console.log(`✅ Loaded ${keywords.length} keywords for channel ${channelId}`);
  }
}
loadKeywords();
setInterval(loadKeywords, 10 * 60 * 1000);

const spoilerWatchMap = new Map();

const allowedChannelIds = Object.keys(channelKeywordSources);

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  if (!allowedChannelIds.includes(message.channelId)) return;

  const prefix = '!';
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = commands.get(commandName);
    if (!command) return;

    if (commandName === 'reloadkeywords') {
      try {
        await reloadCommand.execute(message, args, keywordMap, channelKeywordSources, fetchKeywords);
      } catch (error) {
        console.error('Error executing reloadkeywords command:', error);
        message.reply('❌ There was an error running that command.');
      }
      return;
    }


    if (commandName === 'contribute') {
      try {
        await contributeCommand.execute(message, args);
      } catch (error) {
        console.error('Error executing contribute command:', error);
        message.reply('❌ There was an error running that command.');
      }
      return;
    }
  }

  const keywords = keywordMap.get(message.channelId);
  if (!keywords) return;

  const matches = findAllMatchedKeywords(message.content, keywords);
  if (!matches) return;

  const unspoileredKeywords = matches.filter(m => !m.spoilered).map(m => m.keyword);
  if (!unspoileredKeywords.length) return;

  if (spoilerWatchMap.has(message.id)) return; // Already watching

  const { prompt, timeout } = await promptAndDelete(message, unspoileredKeywords);

  spoilerWatchMap.set(message.id, {
    message,
    prompt,
    timeout,
    keywords: unspoileredKeywords,
  });
});


client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!spoilerWatchMap.has(newMessage.id)) return;

  const watchData = spoilerWatchMap.get(newMessage.id);
  const { message, prompt, timeout } = watchData;

  if (newMessage.author?.bot) return;

  const allChannelKeywords = keywordMap.get(newMessage.channelId);
  const matches = findAllMatchedKeywords(newMessage.content, allChannelKeywords);

  if (!matches || matches.length === 0) {
    clearTimeout(timeout);
    await message.delete().catch(() => { });
    await prompt.delete().catch(() => { });
    spoilerWatchMap.delete(newMessage.id);
    return;
  }

  const stillUnspoilered = matches.filter(m => !m.spoilered).map(m => m.keyword);

  if (stillUnspoilered.length === 0) {
    clearTimeout(timeout);
    await prompt.delete().catch(() => { });
    spoilerWatchMap.delete(newMessage.id);
  } else {
    try {
      const oneMinuteLater = Math.floor((message.createdTimestamp + 60 * 1000) / 1000);

      await prompt.edit(
        `⚠️ Please spoiler-tag the following keywords by surrounding them \\|\\|like this\\|\\|:\n${stillUnspoilered.map(words => `||${words}||`).join(', ')}\nYour message will be deleted <t:${oneMinuteLater}:R> unless spoilers are resolved.`
      );

      watchData.keywords = stillUnspoilered;
    } catch (error) {
      console.error('Failed to edit prompt:', error);
    }
  }
});

client.once(Events.ClientReady, () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
