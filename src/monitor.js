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
async function sendAlert(errorLogs, config) {
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
      timestamp: new Date().toISOString(),
      alertType: 'error_log_detected',
      errorCount: errorLogs.length,
      errors: errorLogs.map(log => ({
        file: log.file,
        lineNumber: log.lineNumber,
        message: log.message,
        timestamp: log.timestamp,
        url: log.url,
        method: log.method
      })),
      summary: `检测到 ${errorLogs.length} 个错误日志`
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

// 检查文件中的错误日志
async function checkFileForErrors(filePath, config) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const errorLogs = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const logData = JSON.parse(lines[i]);
        if (logData.level === 'error') {
          errorLogs.push({
            file: path.relative(config.staticRoot, filePath),
            lineNumber: i + 1,
            message: logData.message || '',
            timestamp: logData.timestamp || '',
            url: logData.url || '',
            method: logData.method || '',
            raw: lines[i]
          });
        }
      } catch (e) {
        // 忽略非JSON格式的行
      }
    }

    return errorLogs;
  } catch (error) {
    console.error(`检查文件错误失败: ${filePath}`, error);
    return [];
  }
}

// 监控所有日志文件
async function monitorLogFiles(config) {
  if (!config.alertEnabled) {
    return;
  }

  try {
    const allErrorLogs = [];
    
    // 递归遍历日志目录
    async function scanDirectory(dirPath) {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (stats.isFile() && item.endsWith('.log')) {
          const errorLogs = await checkFileForErrors(fullPath, config);
          allErrorLogs.push(...errorLogs);
        }
      }
    }

    await scanDirectory(config.staticRoot);

    // 如果错误数量超过阈值，发送告警
    if (allErrorLogs.length >= config.alertThreshold) {
      console.log(`检测到 ${allErrorLogs.length} 个错误日志，准备发送告警`);
      await sendAlert(allErrorLogs, config);
    }

    alertState.errorCount = allErrorLogs.length;
  } catch (error) {
    console.error('监控日志文件失败:', error);
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
  console.log(`告警阈值: ${config.alertThreshold} 个错误`);
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