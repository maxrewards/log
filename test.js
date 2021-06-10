const DDL = require('./lib/index').default;
const appName = 'mxr-test-env';
const options = [{}, true];
const logger = new DDL(appName, process.env.API_KEY, ...options);
const child = logger.create('asdfasdfasdfasd', { obj: { accounts: [], id: 'asdfasfd', bool: true, object: { internalProp: 1, string: 'string' } } });
try {
  child.info('this is a test');
  throw new Error('eeeeee');
} catch(e) {
  child.error(e);
}
