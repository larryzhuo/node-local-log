const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const initRouter = require('./router');
const { startMonitoring } = require('./monitor');


class LogServer {
  constructor(options = {}) {

    this.config = {
      port: options.port || 3000,
      // 静态文件根目录
      staticRoot: options.staticRoot || path.resolve(__dirname, '../logs'),
      // JWT配置
      jwtSecret: options.jwtSecret || 'your-secret-key',
      jwtExpiresIn: options.jwtExpiresIn || '24h',
      // 默认登录凭据
      username: options.username || 'admin',
      password: options.password || 'admin123',
      // 分页配置
      defaultPageSize: 50,
      maxPageSize: 1000,
      // 告警配置
      alertUrl: options.alertUrl || '',
      alertEnabled: options.alertEnabled || false,
      errorFile: options.errorFile || '', //监控的错误日志路径
      alertInterval: options.alertInterval || 60000, // 默认1分钟检查一次
      alertCooldown: options.alertCooldown || 300000 // 默认5分钟冷却时间
    };

    global.LocalLogJwtSecret = this.config.jwtSecret;

    this.app = express();

    // 中间件
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // 限流
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100 // 限制每个IP 15分钟内最多100个请求
    });
    this.app.use(limiter);

    // 初始化路由
    initRouter(this.app, this.config);


    // 错误处理中间件
    this.app.use((err, req, res, next) => {
      console.error('服务器错误:', err);
      res.status(500).json({ error: '服务器内部错误' });
    });

    // 404处理,放在所有路由之后
    this.app.use((req, res) => {
      res.status(404).json({ error: '接口不存在' });
    });

  }


  start() {
    // 启动服务器
    this.server = this.app.listen(this.config.port, () => {
      console.log(`服务器运行在 http://localhost:${this.config.port}`);
      console.log(`静态文件根目录: ${path.resolve(this.config.staticRoot)}`);
      
      // 启动告警监控
      startMonitoring(this.config);
    });
  }

  stop() {
    if(this.server) {
      this.server.close((err) => {
        if (err) {
          console.error('服务器关闭失败:', err);
          process.exit(1); // 异常退出
        }
        console.log('服务器已优雅关闭');
        process.exit(0); // 正常退出
      });
    }
  }

}


module.exports = {
  LogServer,
};
