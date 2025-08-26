#!/usr/bin/env node

const { LogServer } = require('./server');

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    let a = args[i];
    if (a.startsWith('--')) {
      a = a.slice(2);
      let key, val;
      const eq = a.indexOf('=');
      if (eq !== -1) {
        key = a.slice(0, eq);
        val = a.slice(eq + 1);
      } else {
        key = a;
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          val = next; i++;
        } else {
          val = 'true';
        }
      }
      out[key] = val;
    } else if (a.startsWith('-')) {
      const key = a.slice(1);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) { out[key] = next; i++; } else { out[key] = 'true'; }
    }
  }
  return out;
}

function normalizeOptions(raw) {
  const toBool = v => ['true', '1', true].includes(v);
  const toNum = v => (v === undefined ? undefined : Number(v));

  return {
    port: toNum(raw.port),
    staticRoot: raw.root || raw.staticRoot,
    jwtSecret: raw['jwt-secret'] || raw.jwtSecret,
    jwtExpiresIn: raw['jwt-expires'] || raw.jwtExpiresIn,
    username: raw.username,
    password: raw.password,
    defaultPageSize: toNum(raw['page-size'] || raw.defaultPageSize),
    maxPageSize: toNum(raw['max-page-size'] || raw.maxPageSize),
    alertUrl: raw['alert-url'] || raw.alertUrl,
    alertEnabled: raw['alert-enabled'] !== undefined ? toBool(raw['alert-enabled']) : undefined,
    errorFile: raw['error-file'],
    alertInterval: toNum(raw['alert-interval'] || raw.alertInterval),
    alertCooldown: toNum(raw['alert-cooldown'] || raw.alertCooldown),
  };
}

(async () => {
  const raw = parseArgs(process.argv);
  if (raw.help || raw.h) {
    console.log(`
Usage: node-local-log [options]

Options:
  --port <number>               服务器端口（默认 3000）
  --root <path>                 日志根目录（默认 ./logs）
  --username <string>           登录用户名（默认 admin）
  --password <string>           登录密码（默认 admin123）
  --jwt-secret <string>         JWT 密钥（默认 your-secret-key）
  --jwt-expires <string>        JWT 过期（默认 24h）
  --page-size <number>          默认分页大小（默认 50）
  --max-page-size <number>      最大分页大小（默认 1000）
  --alert-url <url>             告警 URL
  --alert-enabled [true|false]  启用告警（默认 false）
  --alert-interval <ms>         告警检查间隔（默认 60000）
  --alert-cooldown <ms>         告警冷却时间（默认 300000）
  -h, --help                    显示帮助
`);
    process.exit(0);
  }

  const opts = normalizeOptions(raw);
  // 清理 undefined，避免覆盖默认值
  Object.keys(opts).forEach(k => opts[k] === undefined && delete opts[k]);

  const server = new LogServer(opts);
  server.start();

  const shutdown = sig => () => {
    console.log(`\n收到信号 ${sig}，准备优雅关闭...`);
    server.stop();
  };
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
})();