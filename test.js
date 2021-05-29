const DDL = require('./lib/index').default;

console.log(new DDL('test', 'test').transports.length);