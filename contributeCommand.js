module.exports = {
  name: 'contribute',
  description: 'Tells users where to contribute keywords',
  async execute(message) {
    return message.reply(
      '🛠️ Want to contribute keywords? \n Please visit [HERE](<https://github.com/Zaliant1/help-bot-keywords/tree/main>)'
    );
  }
};
