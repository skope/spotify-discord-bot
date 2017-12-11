const Discord = require('discord.js');
const logger = require('../logger');
const Promise = require('bluebird');
const Token = require('./Token');
const { map } = require('lodash');
const SpotifyWebApi = require('spotify-web-api-node');
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  redirectUri: process.env.OAUTH2_CALLBACK_URL
});

class Bot {
  constructor(discordToken) {
    this.client = new Discord.Client();
    this.discordToken = discordToken;

    this.client.on('ready', this.setUsername.bind(this.client));
    this.client.on('ready', () => logger.info('Discord bot ready'));

    this.client.on('message', this.handleMessage.bind(this));
  }

  /**
   * Login bot to services
   *
   * @return {Promise}
   */
  start() {
    return this.client.login(this.discordToken);
  }

  /**
   * Set bots username if it's not the same as specified in
   * DISCORD_USERNAME environment variable.
   *
   * @return {Boolean|Promise}
   */
  setUsername() {
    if (this.user.username !== process.env.DISCORD_USERNAME) {
      return this.user.setUsername(process.env.DISCORD_USERNAME)
        .then(() =>
          logger.info(`Changed Discord username to ${process.env.DISCORD_USERNAME}`)
        )
        .catch(error =>
          logger.error('An error occurred while changing Discord username', error)
        );
    }

    return Promise.resolve();
  }

  /**
   * Handles incoming messages and detects if given message is
   * a command message.
   *
   * @param  {Object}          message  Discord message object
   * @return {Boolean|Promise}          False when nothing was did, method
   *                                    according to command otherwise
   */
  handleMessage(message) {
    const { author, content } = message;

    /*
     * Do not accept messages from other bots to prevent
     * infinite reply loops
     */
    if (author.bot === true) {
      return false;
    }

    /*
     * Check if message is command message
     */
    if (content.startsWith('.') === false) {
      return false;
    }

    /*
     * Discord identifier of the user who called the command
     */
    const username = `${author.username}#${author.discriminator}`;

    const command = content.split(' ')[0].substr(1);
    const args = content.split(' ').slice(1);

    if (command === 'np') {
      return this.nowPlaying(username)
        .then(track => message.reply(track))
        .catch(error => {
          if (error.message === 'Token not found') {
            logger.error(`User ${username} is not authorized to use now playing command`);

            return message.reply('You are not authorized to use this command. Please authorize the bot in https://dsb.psykedelia.org/');
          }

          logger.error('An error occurred while fetching now playing status', error);

          message.reply('An error occurred while fetching status');
        });
    }
  }

  /**
   * Fetches now playing status from Spotify API
   *
   * @param  {String} username Discord username of the wanted user
   * @return {String}          Now playing track
   */
  nowPlaying(username) {
    const token = new Token();

    return token.getToken(username)
      .then(data => token.checkToken(data, username))
      .then(data => spotifyApi.setAccessToken(data.access_token))
      .then(() => spotifyApi.getMyCurrentPlayingTrack())
      .then(result => ({
        artist: result.body.item.artists[0].name,
        name: result.body.item.name,
        album: result.body.item.album.name,
        playing: result.body.is_playing
      }))
      .then(data => `${data.artist} - ${data.name} [${data.album}] ${!data.playing ? '(paused)' : ''}`);
  }
}

module.exports = Bot;
