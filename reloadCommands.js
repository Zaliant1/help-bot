module.exports = {
  name: 'reloadkeywords',
  description: 'Reload keywords for a specified channel',
  async execute(message, args, keywordMap, channelKeywordSources, fetchKeywords) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply("🚫 You don't have permission to reload keywords.");
    }

    const channelMention = args[0];
    if (!channelMention) {
      return message.reply("❗ Please mention a channel, e.g. `!reloadkeywords #hk-help`");
    }

    const channelIdMatch = channelMention.match(/^<#(\d+)>$/);
    if (!channelIdMatch) {
      return message.reply("❗ Invalid channel mention format. Please mention the channel like `#channel`.");
    }

    const channelId = channelIdMatch[1];
    const url = channelKeywordSources[channelId];

    if (!url) {
      return message.reply(`❗ No keyword source URL configured for <#${channelId}>.`);
    }

    try {
      const keywords = await fetchKeywords(url);
      keywordMap.set(channelId, keywords);
      console.log(`✅ Manually reloaded ${keywords.length} keywords for ${channelId}`);
      return message.reply(`🔄 Keywords reloaded for <#${channelId}>!`);
    } catch (error) {
      console.error('Error reloading keywords:', error);
      return message.reply('❌ Failed to reload keywords.');
    }
  }
};
