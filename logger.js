const winston = require('winston');
const config = winston.config;
const moment = require('moment');

module.exports = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      level: 'debug',
      timestamp: () => moment().format('YYYY-MM-DD HH:mm:ss'),
      formatter(options) {
        const { timestamp, message } = options;
        const level = config.colorize(
          options.level, options.level.toUpperCase()
        );
        const meta = (options.meta && Object.keys(options.meta).length ?
          '\n\t'+ JSON.stringify(options.meta) :
          ''
        );

        return `[${timestamp()}] ${level} ${message} ${meta}`;
      }
    })
  ]
});
