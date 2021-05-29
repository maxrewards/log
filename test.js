const DDL = require('./lib/index').default;

const appName = '';
const options = [{}, false];
const logger = new DDL(appName, process.env.API_KEY, ...options);
