const Promise = require('bluebird');
const AWS = require('aws-sdk');
const moment = require('moment');

const logger = require('../logger');

AWS.config.update({
  region: 'eu-central-1'
});

const credentials = {
  client: {
    id: process.env.SPOTIFY_CLIENT_ID,
    secret: process.env.SPOTIFY_CLIENT_SECRET
  },
  auth: {
    tokenHost: 'https://accounts.spotify.com',
    tokenPath: '/api/token',
    authorizePath: '/authorize'
  }
};

const oauth2 = require('simple-oauth2');

class Token {
  constructor() {
    /*
     * OAuth2 table in DynamoDB
     */
    this.tableName = 'discord-spotify-auth';

    this.docClient = new AWS.DynamoDB.DocumentClient();
    this.oauth2 = oauth2.create(credentials);
  }

  /**
   * Create OAuth2 access token from token data
   *
   * @param  {Object} token Token data
   * @return {Object}
   */
  createToken(token) {
    return this.oauth2.accessToken.create(token);
  }

  /**
   * Checks if token is expired and renews it
   *
   * @param  {String} token    Current token
   * @param  {String} username Discord identifier of the related user
   * @return {Promise}
   */
  checkToken(token, username) {
    const refreshToken = token.refresh_token;
    const accessToken = this.createToken(token);

    if (accessToken.expired() === false) {
      return new Promise.resolve(token);
    }

    logger.info(`Refreshing access token for user ${username}`);

    return accessToken
      .refresh()
      .then(result => this.putToken(Object.assign(result.token, {
        refresh_token: refreshToken
      }), username))
      .then(() => accessToken.token);
  }

  /**
   * Retrieves user token from the database
   *
   * @param  {String} username Discord identifier of the related user
   * @return {Promise}         Resolves to token data
   */
  getToken(username) {
    return new Promise((resolve, reject) => {
      const params = {
        TableName: this.tableName,
        KeyConditionExpression: '#username = :username',
        ExpressionAttributeNames: {
          '#username': 'username'
        },
        ExpressionAttributeValues: {
          ':username': username
        }
      };

      this.docClient.query(params, (error, result) => {
        if (error) {
          logger.error('Error while connecting to the database', error);

          return reject(new Error('Error while connecting to the database'));
        }

        if (result.Count === 0) {
          return reject(new Error('Token not found'));
        }

        delete result.Items[0].username;

        return resolve(result.Items[0]);
      });
    });
  }

  /**
   * Obtains new token from the OAuth2 server
   *
   * @param  {String} code     Authorization code from OAuth2
   * @param  {String} username Discord identifier of the related user
   * @return {Promise}
   */
  getNewToken(code, username) {
    return this.oauth2
      .authorizationCode
      .getToken({
        redirect_uri: process.env.OAUTH2_CALLBACK_URL,
        code
      });
  }

  /**
   * Adds new token to the database
   *
   * @param  {Object} tokenData Token object
   * @param  {String} username  Discord identifier of the related user
   * @return {Promise}
   */
  putToken(tokenData, username) {
    return new Promise((resolve, reject) => {
      const token = this.createToken(tokenData).token;

      token['username'] = username;
      token['expires_at'] = moment(token.expires_at).format();

      const params = {
        TableName: this.tableName,
        Item: token
      };

      this.docClient.put(params, (error, data) => {
        if (error) {
          logger.error('An error occurred while putting token data to DynamoDB', error);

          return reject(error);
        }

        return resolve(token);
      });
    });
  }

  /**
   * Deletes a token from the database
   *
   * @param  {String} username Discord identifier of the user
   * @return {Promise}
   */
  deleteToken(username) {
    return new Promise((resolve, reject) => {
      const params = {
        TableName: this.tableName,
        Key: {username}
      };

      this.docClient.delete(params, (error, data) => {
        if (error) {
          logger.error('An error occurred while deleting token data from DynamoDB', error);

          return reject(new Error(error));
        }

        return resolve();
      });
    });
  }

  /**
   * Creates authorization URI to OAuth2 server
   *
   * @param  {String} username Discord identifier of the related user
   * @return {String}          Authorization URI
   */
  createAuthorizationUri(username) {
    return this.oauth2.authorizationCode.authorizeURL({
      redirect_uri: process.env.OAUTH2_CALLBACK_URL,
      scope: 'user-read-currently-playing',
      state: username
    });
  }
}

module.exports = Token;
