const {LogServer} = require('./index.js');


new LogServer({
  port: 7999
}).start();