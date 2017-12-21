require('dotenv').config();

const Bot = require('./src/Bot');

/*
 * Initialize Discord bot
 */
const bot = new Bot(process.env.DISCORD_TOKEN);

bot.start();
