const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const { startMonitoring } = require('./monitor');
const { sendAlert } = require('./monitor');
const { alertState } = require('./monitor');

// JWT认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '访问令牌缺失' });
  }

  jwt.verify(token, global.LocalLogJwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '访问令牌无效' });
    }
    req.user = user;
    next();
  });
};


//路由初始化
function initRouter(app, config) {
  // 登录接口
  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
      }

      // 验证用户名和密码
      if (username === config.username && password === config.password) {
        const token = jwt.sign(
          { username: username },
          config.jwtSecret,
          { expiresIn: config.jwtExpiresIn }
        );

        res.json({
          success: true,
          token: token,
          expiresIn: config.jwtExpiresIn
        });
      } else {
        res.status(401).json({ error: '用户名或密码错误' });
      }
    } catch (error) {
      console.error('登录错误:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  });

  // 验证令牌接口
  app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
  });

  // 获取告警配置
  app.get('/api/alert/config', authenticateToken, (req, res) => {
    res.json({
      enabled: config.alertEnabled,
      url: config.alertUrl,
      interval: config.alertInterval,
      threshold: config.alertThreshold,
      cooldown: config.alertCooldown,
      isMonitoring: alertState.isMonitoring,
      lastAlertTime: alertState.lastAlertTime,
      errorCount: alertState.errorCount
    });
  });

  // 更新告警配置
  app.post('/api/alert/config', authenticateToken, (req, res) => {
    try {
      const { enabled, url, interval, threshold, cooldown } = req.body;
      
      if (enabled !== undefined) config.alertEnabled = enabled;
      if (url !== undefined) config.alertUrl = url;
      if (interval !== undefined) config.alertInterval = parseInt(interval);
      if (threshold !== undefined) config.alertThreshold = parseInt(threshold);
      if (cooldown !== undefined) config.alertCooldown = parseInt(cooldown);
      
      // 如果启用了告警但监控未启动，则启动监控
      if (config.alertEnabled && !alertState.isMonitoring) {
        startMonitoring();
      }
      
      res.json({ success: true, message: '告警配置已更新' });
    } catch (error) {
      console.error('更新告警配置失败:', error);
      res.status(500).json({ error: '更新告警配置失败' });
    }
  });

  // 手动触发告警测试
  app.post('/api/alert/test', authenticateToken, async (req, res) => {
    try {
      if (!config.alertEnabled || !config.alertUrl) {
        return res.status(400).json({ error: '告警功能未启用或URL未配置' });
      }

      const testError = [{
        file: 'test.log',
        lineNumber: 1,
        message: '这是一条测试告警消息',
        timestamp: new Date().toISOString(),
        url: '/api/test',
        method: 'GET'
      }];

      await sendAlert(testError);
      res.json({ success: true, message: '测试告警已发送' });
    } catch (error) {
      console.error('测试告警失败:', error);
      res.status(500).json({ error: '测试告警失败: ' + error.message });
    }
  });

  // 获取目录列表
  app.get('/api/directory', authenticateToken, async (req, res) => {
    try {
      const { path: dirPath = '' } = req.query;
      const fullPath = path.join(config.staticRoot, dirPath);
      
      // 安全检查：确保路径在允许的根目录内
      const resolvedPath = path.resolve(fullPath);
      const rootPath = path.resolve(config.staticRoot);
      
      if (!resolvedPath.startsWith(rootPath)) {
        return res.status(403).json({ error: '访问被拒绝' });
      }

      const stats = await fs.stat(fullPath);
      
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: '指定路径不是目录' });
      }

      const items = await fs.readdir(fullPath);
      const directoryItems = [];

      for (const item of items) {
        const itemPath = path.join(fullPath, item);
        const itemStats = await fs.stat(itemPath);
        
        directoryItems.push({
          name: item,
          path: path.join(dirPath, item).replace(/\\/g, '/'),
          isDirectory: itemStats.isDirectory(),
          size: itemStats.isFile() ? itemStats.size : null,
          modifiedTime: itemStats.mtime
        });
      }

      // 按类型和名称排序
      directoryItems.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return b.isDirectory ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });

      res.json({
        currentPath: dirPath,
        items: directoryItems
      });
    } catch (error) {
      console.error('获取目录列表错误:', error);
      res.status(500).json({ error: '获取目录列表失败' });
    }
  });

  // 读取日志文件
  app.get('/api/logs', authenticateToken, async (req, res) => {
    try {
      const { file, page = 1, limit = config.defaultPageSize, keyword = '' } = req.query;
      
      if (!file) {
        return res.status(400).json({ error: '文件路径不能为空' });
      }

      const filePath = path.join(config.staticRoot, file);
      
      // 安全检查
      const resolvedPath = path.resolve(filePath);
      const rootPath = path.resolve(config.staticRoot);
      
      if (!resolvedPath.startsWith(rootPath)) {
        return res.status(403).json({ error: '访问被拒绝' });
      }

      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return res.status(400).json({ error: '指定路径不是文件' });
      }

      const pageSize = Math.min(parseInt(limit), config.maxPageSize);
      const pageNum = Math.max(1, parseInt(page));

      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');

      // 关键词过滤
      let filteredLines = lines;
      if (keyword) {
        filteredLines = lines.filter(line => 
          line.toLowerCase().includes(keyword.toLowerCase())
        );
      }

      // 分页
      const totalLines = filteredLines.length;
      const totalPages = Math.ceil(totalLines / pageSize);
      const startIndex = (pageNum - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pageLines = filteredLines.slice(startIndex, endIndex);

      // 解析JSON日志
      const parsedLogs = pageLines.map((line, index) => {
        try {
          const logData = JSON.parse(line);
          return {
            lineNumber: startIndex + index + 1,
            level: logData.level || 'unknown',
            message: logData.message || '',
            timestamp: logData.timestamp || '',
            method: logData.method || '',
            url: logData.url || '',
            reqId: logData.reqId || '',
            pid: logData.pid || '',
            startTime: logData.startTime || '',
            raw: line
          };
        } catch (e) {
          return {
            lineNumber: startIndex + index + 1,
            level: 'unknown',
            message: line,
            timestamp: '',
            method: '',
            url: '',
            reqId: '',
            pid: '',
            startTime: '',
            raw: line
          };
        }
      });

      res.json({
        file: file,
        totalLines: totalLines,
        totalPages: totalPages,
        currentPage: pageNum,
        pageSize: pageSize,
        logs: parsedLogs,
        fileSize: stats.size,
        lastModified: stats.mtime
      });
    } catch (error) {
      console.error('读取日志文件错误:', error);
      res.status(500).json({ error: '读取日志文件失败' });
    }
  });

  // 搜索日志
  app.get('/api/search', authenticateToken, async (req, res) => {
    try {
      const { file, keyword, limit = 100 } = req.query;
      
      if (!file || !keyword) {
        return res.status(400).json({ error: '文件路径和关键词不能为空' });
      }

      const filePath = path.join(config.staticRoot, file);
      
      // 安全检查
      const resolvedPath = path.resolve(filePath);
      const rootPath = path.resolve(config.staticRoot);
      
      if (!resolvedPath.startsWith(rootPath)) {
        return res.status(403).json({ error: '访问被拒绝' });
      }

      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return res.status(400).json({ error: '指定路径不是文件' });
      }

      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      const searchResults = [];
      const maxResults = Math.min(parseInt(limit), config.maxPageSize);

      for (let i = 0; i < lines.length && searchResults.length < maxResults; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes(keyword.toLowerCase())) {
          try {
            const logData = JSON.parse(line);
            searchResults.push({
              lineNumber: i + 1,
              level: logData.level || 'unknown',
              message: logData.message || '',
              timestamp: logData.timestamp || '',
              method: logData.method || '',
              url: logData.url || '',
              reqId: logData.reqId || '',
              pid: logData.pid || '',
              startTime: logData.startTime || '',
              raw: line
            });
          } catch (e) {
            searchResults.push({
              lineNumber: i + 1,
              level: 'unknown',
              message: line,
              timestamp: '',
              method: '',
              url: '',
              reqId: '',
              pid: '',
              startTime: '',
              raw: line
            });
          }
        }
      }

      res.json({
        file: file,
        keyword: keyword,
        totalResults: searchResults.length,
        results: searchResults
      });
    } catch (error) {
      console.error('搜索日志错误:', error);
      res.status(500).json({ error: '搜索日志失败' });
    }
  });

  // 静态文件服务
  app.use('/static', express.static(path.join(__dirname, 'public')));

  // 前端页面路由
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      alertEnabled: config.alertEnabled,
      alertMonitoring: alertState.isMonitoring,
      errorCount: alertState.errorCount
    });
  });

}

module.exports = initRouter;