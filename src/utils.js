function findAllMatchedKeywords(messageContent, keywords) {
  const normalize = str =>
    str.toLowerCase().replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim();

  const normalizedMessage = normalize(messageContent);
  const spoilerMatches = [...messageContent.matchAll(/\|\|(.+?)\|\|/g)].map(m => normalize(m[1]));
  const results = [];

  for (const keyword of keywords) {
    const normKeyword = normalize(keyword);

    const keywordRegex = new RegExp(`\\b${normKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (!keywordRegex.test(normalizedMessage)) continue;

    const spoilered = spoilerMatches.some(spoilerText => {
      const spoilerRegex = new RegExp(`\\b${normKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return spoilerRegex.test(spoilerText);
    });

    results.push({ keyword, spoilered });
  }

  return results.length > 0 ? results : null;
}

async function promptAndDelete(message, keywords) {
  const oneMinuteLater = Math.floor((message.createdTimestamp + 60 * 1000) / 1000);

  const prompt = await message.reply(
    `⚠️ Please spoiler-tag the following keywords by surrounding them \\|\\|like this\\|\\|:\n**${keywords.join(', ')}**\nYou have until <t:${oneMinuteLater}:R> to edit your message.`
  );

  const timeout = setTimeout(async () => {
    await message.delete().catch(() => { });
    await prompt.delete().catch(() => { });
  }, 60_000);

  return { prompt, timeout };
}

module.exports = {
  findAllMatchedKeywords,
  promptAndDelete,
};
