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
    this.tableName = 'discord-spotify-auth';
    this.docClient = new AWS.DynamoDB.DocumentClient();
    this.oauth2 = oauth2.create(credentials);
  }

  checkToken(token, username) {
    const accessToken = this.oauth2.accessToken.create(token);

    if (accessToken.expired() === false) {
      return new Promise(resolve => resolve(token));
    }

    return accessToken
      .refresh()
      .then(result => this.putToken(result.token, username))
      .then(() => accessToken);
  }

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

  getNewToken(code, username) {
    return this.oauth2
      .authorizationCode
      .getToken({
        redirect_uri: process.env.OAUTH2_CALLBACK_URL,
        code
      });
  }

  putToken(tokenData, username) {
    return new Promise((resolve, reject) => {
      const token = this.oauth2.accessToken.create(tokenData).token;

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

  createAuthorizationUri(username) {
    return this.oauth2.authorizationCode.authorizeURL({
      redirect_uri: process.env.OAUTH2_CALLBACK_URL,
      scope: 'user-read-currently-playing',
      state: username
    });
  }
}

module.exports = Token;
