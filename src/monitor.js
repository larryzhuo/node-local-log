const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const http = require('http');

// 告警状态管理
const alertState = {
  lastAlertTime: 0,
  errorCount: 0,
  isMonitoring: false,
  monitoredFiles: new Set()
};

// 发送告警
async function sendAlert(config) {
  if (!config.alertEnabled || !config.alertUrl) {
    return;
  }

  const now = Date.now();
  
  // 检查冷却时间
  if (now - alertState.lastAlertTime < config.alertCooldown) {
    console.log('告警冷却中，跳过告警');
    return;
  }

  try {
    const alertData = {
      "msg_type": "text",
      "content": {
          "text": `错误日志发生变动: ${config.errorFile}`
      }
    };

    const url = new URL(config.alertUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const postData = JSON.stringify(alertData);
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Node-Local-Log-Alert/1.0'
      },
      timeout: 10000 // 10秒超时
    };

    return new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          console.log(`告警发送成功: ${res.statusCode}`);
          alertState.lastAlertTime = now;
          resolve({ statusCode: res.statusCode, data });
        });
      });

      req.on('error', (err) => {
        console.error('告警发送失败:', err.message);
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('告警请求超时'));
      });

      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('告警发送异常:', error);
  }
}


let mtimeOld = 0;
let lineCountOld = 0;

// 监控所有日志文件
async function monitorLogFiles(config) {
  if (!config.alertEnabled || !config.errorFile) {
    return;
  }
  let filePath = config.errorFile;
  try {
    const stats = await fs.promises.stat(filePath);
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    if(mtimeOld && lineCountOld) {
      if(mtimeOld != stats.mtimeMs && lineCountOld != lines.length) {
        //告警
        await sendAlert(config);
      }
    }
    mtimeOld = stats.mtimeMs
    lineCountOld = lines.length;
  } catch(e) {
    // console.warn(e);
  }
}

// 启动监控
function startMonitoring(config) {
  if (!config.alertEnabled) {
    console.log('告警功能已禁用');
    return;
  }

  if (!config.alertUrl) {
    console.log('告警URL未配置，告警功能不可用');
    return;
  }

  console.log(`启动错误日志监控，检查间隔: ${config.alertInterval}ms`);
  console.log(`告警URL: ${config.alertUrl}`);
  console.log(`错误日志文件: ${config.errorFile}`);
  console.log(`告警冷却时间: ${config.alertCooldown}ms`);

  alertState.isMonitoring = true;
  
  // 立即执行一次检查
  monitorLogFiles(config);
  
  // 设置定时检查
  setInterval(() => {
    monitorLogFiles(config);
  }, config.alertInterval);
}


module.exports = {
  startMonitoring,
  sendAlert,
  alertState
};