const {LogServer} = require('./index.js');


new LogServer({
  port: 7999,
  alertEnabled: true,
  alertUrl: 'https://open.larksuite.com/open-apis/bot/v2/hook/82d93e74-c8c3-4948-b414-9084c59af77c',
  errorFile: '/Users/xz/Documents/SENHENG_BE/logs/SENHENG_BE/common-error.log',
  // alertInterval: 5000,
}).start();