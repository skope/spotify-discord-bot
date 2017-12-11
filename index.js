require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const nunjucks = require('nunjucks');
const app = express();

const logger = require('./logger');

const Token = require('./src/Token');
const Bot = require('./src/Bot');

/*
 * Initialize Discord bot
 */
const bot = new Bot(process.env.DISCORD_TOKEN);

bot.start();

app.use(bodyParser.urlencoded({
  extended: false
}));

nunjucks.configure('views', {
    autoescape: true,
    express: app,
    noCache: process.env.NODE_ENV === 'production' ? false : true
});

app.get('/', (req, res) =>
  res.render('index.html', {
    apiUrl: process.env.API_URL
  })
);

app.post('/', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({
      status: 'error',
      message: 'No username specified'
    });
  }

  const token = new Token();

  token.getToken(username)
    .then(data => {
      logger.debug(`Token found for user ${username}`);

      res.json({
        status: 'ok',
        message: 'You are already authorized with the bot!',
        authorized: true
      });
    })
    .catch(error => {
      logger.info(`Token not found for user ${username}, displaying authorization URL`);

      res.json({
        status: 'ok',
        authorizationUri: token.createAuthorizationUri(username),
        authorized: false
      });
    });
});

app.delete('/', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({
      status: 'error',
      message: 'No username specified'
    });
  }

  const token = new Token();

  token.deleteToken(username)
    .then(() => {
      logger.info(`Token of username ${username} delete from the server`);

      res.json({
        status: 'ok'
      });
    })
    .catch(error => {
      logger.error('An error occurred while deleting a token from DynamoDB', error);

      res.status(500).json({
        status: 'error',
        message: 'An error occurred while deleting a token'
      });
    })
});

app.get('/callback', (req, res) => {
  const { code, state, error = null } = req.query;

  if (error !== null) {
    logger.error('Spotify OAuth2 authorization failed', error);

    return res.redirect('/');
  }

  const token = new Token();

  token.getNewToken(code, state)
    .then(data => token.putToken(data, state))
    .then(() => res.redirect('/'))
    .catch(error => res.status(500).json({
      status: 'error',
      message: 'An error occurred while obtaining new token from Spotify API'
    }));
});

app.listen(process.env.PORT, () =>
  logger.info(`HTTP server listening on port ${process.env.PORT}`)
);
