# 本地日志查看器

一个基于Node.js的本地日志文件查看服务器，提供Web界面来浏览、搜索和查看JSON格式的日志文件，并支持错误日志监控和告警功能。

## 功能特性

- 🔐 **JWT认证**: 支持用户名密码登录，使用JWT令牌进行身份验证
- 📁 **文件浏览器**: 支持目录浏览和文件选择
- 📄 **日志查看**: 支持JSON格式日志的解析和显示
- 🔍 **关键词搜索**: 支持在日志文件中搜索关键词
- 📊 **分页显示**: 支持大量日志的分页浏览
- 🎨 **现代化UI**: 响应式设计，支持移动端访问
- 🔒 **安全防护**: 路径遍历防护、请求限流等安全措施
- 🚨 **错误监控**: 实时监控error级别日志，支持告警通知
- ⚙️ **告警配置**: 可视化配置告警参数和Webhook URL

## 安装和运行

### 1. 安装依赖

```bash
npm install
```

### 2. 引入LogServer，并 start

```bash

const {LogServer} = require('./index.js');


new LogServer({
  port: 7999
}).start();

```

### 3. 启动服务器

```bash


```

### 4. 访问应用

打开浏览器访问: http://localhost:3000

默认登录凭据:
- 用户名: `admin`
- 密码: `admin123`

## 日志格式

应用支持JSON格式的日志文件，每行一个JSON对象。示例格式：

```json
{
  "level": "info",
  "message": "API response",
  "method": "GET",
  "pid": 28,
  "reqId": "FErreQkBANP5cCA8sSzet7Yv6HAKynsf",
  "startTime": 1755048951669,
  "timestamp": "2025-08-13 09:35:51,681",
  "url": "/api/features/list"
}
```

## 告警功能（测试中，暂时不开放）

### 功能概述

告警功能可以实时监控日志文件中的error级别日志，当检测到错误时自动发送告警通知。

### 告警配置

1. **启用告警**: 在Web界面中点击"告警配置"按钮
2. **配置Webhook URL**: 设置接收告警的HTTP/HTTPS端点
3. **设置参数**:
   - **检查间隔**: 监控检查的频率（建议不少于10秒）
   - **冷却时间**: 两次告警之间的最小间隔

### 告警数据格式

告警将以POST请求发送到配置的URL，数据格式如下：

```json
{
  "timestamp": "2025-08-25T06:03:18.998Z",
  "alertType": "error_log_detected",
  "errorCount": 2,
  "errors": [
    {
      "file": "sample.log",
      "lineNumber": 3,
      "message": "Database connection failed: timeout after 30 seconds",
      "timestamp": "2025-08-13 09:35:52,000",
      "url": "/api/users/create",
      "method": "POST"
    }
  ],
  "summary": "检测到 2 个错误日志"
}
```

### 告警测试

在告警配置界面中，可以点击"测试告警"按钮来验证告警功能是否正常工作。

## API接口

### 认证接口

- `POST /api/login` - 用户登录
- `GET /api/verify` - 验证JWT令牌

### 文件操作接口

- `GET /api/directory` - 获取目录列表
- `GET /api/logs` - 读取日志文件（支持分页和搜索）
- `GET /api/search` - 搜索日志内容

### 告警接口

- `GET /api/alert/config` - 获取告警配置
- `POST /api/alert/config` - 更新告警配置
- `POST /api/alert/test` - 测试告警功能

### 系统接口

- `GET /api/health` - 健康检查

## 使用说明

1. **登录系统**: 使用配置的用户名和密码登录
2. **浏览文件**: 在左侧文件浏览器中导航到日志文件
3. **查看日志**: 点击文件查看日志内容
4. **搜索日志**: 使用搜索框输入关键词进行搜索
5. **分页浏览**: 使用分页控件浏览大量日志
6. **查看详情**: 点击"详情"按钮查看完整的日志行
7. **配置告警**: 点击"告警配置"按钮设置错误监控和告警

## 安全特性

- **路径遍历防护**: 防止访问指定目录外的文件
- **JWT认证**: 基于令牌的身份验证
- **请求限流**: 防止API滥用
- **输入验证**: 对所有用户输入进行验证
- **错误处理**: 安全的错误信息处理
- **告警冷却**: 防止告警风暴

## 技术栈

- **后端**: Node.js, Express.js
- **前端**: 原生JavaScript, HTML5, CSS3
- **认证**: JWT (jsonwebtoken)
- **安全**: Helmet, CORS, Rate Limiting
- **文件操作**: fs-extra
- **网络请求**: http/https (告警功能)
