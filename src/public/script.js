// 全局变量
let currentToken = localStorage.getItem('token');
let currentUser = localStorage.getItem('user');
let currentPath = '';
let currentFile = '';
let currentPage = 1;
let currentPageSize = 50;
let currentKeyword = '';

// DOM元素
const loginContainer = document.getElementById('loginContainer');
const mainContainer = document.getElementById('mainContainer');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const currentUserSpan = document.getElementById('currentUser');
const logoutBtn = document.getElementById('logoutBtn');
const alertConfigBtn = document.getElementById('alertConfigBtn');
const fileList = document.getElementById('fileList');
const currentPathSpan = document.getElementById('currentPath');
const refreshBtn = document.getElementById('refreshBtn');
const currentFileSpan = document.getElementById('currentFile');
const fileInfo = document.getElementById('fileInfo');
const searchKeyword = document.getElementById('searchKeyword');
const searchBtn = document.getElementById('searchBtn');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const downloadBtn = document.getElementById('downloadBtn');
const pageSize = document.getElementById('pageSize');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const logTableBody = document.getElementById('logTableBody');
const loading = document.getElementById('loading');
const logModal = document.getElementById('logModal');
const logDetail = document.getElementById('logDetail');
const closeModal = document.getElementById('closeModal');

// 告警配置相关元素
const alertModal = document.getElementById('alertModal');
const closeAlertModal = document.getElementById('closeAlertModal');
const alertConfigForm = document.getElementById('alertConfigForm');
const alertEnabled = document.getElementById('alertEnabled');
const alertUrl = document.getElementById('alertUrl');
const alertInterval = document.getElementById('alertInterval');
const alertThreshold = document.getElementById('alertThreshold');
const alertCooldown = document.getElementById('alertCooldown');
const testAlertBtn = document.getElementById('testAlertBtn');
const cancelAlertConfig = document.getElementById('cancelAlertConfig');
const alertStatusInfo = document.getElementById('alertStatusInfo');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// 初始化应用
function initializeApp() {
    if (currentToken && currentUser) {
        // 验证令牌
        verifyToken().then(valid => {
            if (valid) {
                showMainInterface();
                loadDirectory();
                loadAlertConfig();
            } else {
                showLoginInterface();
            }
        }).catch(() => {
            showLoginInterface();
        });
    } else {
        showLoginInterface();
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 登录表单
    loginForm.addEventListener('submit', handleLogin);
    
    // 退出登录
    logoutBtn.addEventListener('click', handleLogout);
    
    // 告警配置
    // alertConfigBtn.addEventListener('click', showAlertConfig);
    closeAlertModal.addEventListener('click', hideAlertConfig);
    cancelAlertConfig.addEventListener('click', hideAlertConfig);
    alertConfigForm.addEventListener('submit', handleAlertConfigSubmit);
    testAlertBtn.addEventListener('click', handleTestAlert);
    
    // 刷新按钮
    refreshBtn.addEventListener('click', loadDirectory);
    
    // 搜索相关
    searchBtn.addEventListener('click', handleSearch);
    downloadBtn.addEventListener('click', handleDownload);
    clearSearchBtn.addEventListener('click', handleClearSearch);
    searchKeyword.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // 分页相关
    pageSize.addEventListener('change', handlePageSizeChange);
    prevPage.addEventListener('click', () => changePage(-1));
    nextPage.addEventListener('click', () => changePage(1));
    
    // 模态框
    closeModal.addEventListener('click', hideModal);
    logModal.addEventListener('click', function(e) {
        if (e.target === logModal) {
            hideModal();
        }
    });
    
    alertModal.addEventListener('click', function(e) {
        if (e.target === alertModal) {
            hideAlertConfig();
        }
    });
}

// 显示登录界面
function showLoginInterface() {
    loginContainer.classList.remove('hidden');
    mainContainer.classList.add('hidden');
    currentToken = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

// 显示主界面
function showMainInterface() {
    loginContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
    currentUserSpan.textContent = currentUser;
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentToken = data.token;
            currentUser = username;
            localStorage.setItem('token', currentToken);
            localStorage.setItem('user', currentUser);
            showMainInterface();
            loadDirectory();
            loadAlertConfig();
            loginError.textContent = '';
        } else {
            loginError.textContent = data.error || '登录失败';
        }
    } catch (error) {
        console.error('登录错误:', error);
        loginError.textContent = '网络错误，请重试';
    }
}

// 处理退出登录
function handleLogout() {
    showLoginInterface();
}

// 验证令牌
async function verifyToken() {
    try {
        const response = await fetch('/api/verify', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// 加载告警配置
async function loadAlertConfig() {
    try {
        const response = await fetch('/api/alert/config', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const config = await response.json();
            updateAlertConfigForm(config);
            updateAlertStatus(config);
        }
    } catch (error) {
        console.error('加载告警配置失败:', error);
    }
}

// 更新告警配置表单
function updateAlertConfigForm(config) {
    alertEnabled.checked = config.enabled;
    alertUrl.value = config.url || '';
    alertInterval.value = config.interval || 60000;
    alertThreshold.value = config.threshold || 1;
    alertCooldown.value = config.cooldown || 300000;
}

// 更新告警状态显示
function updateAlertStatus(config) {
    const lastAlertTime = config.lastAlertTime ? new Date(config.lastAlertTime).toLocaleString() : '从未';
    
    alertStatusInfo.innerHTML = `
        <div class="alert-status-item">
            <span class="alert-status-label">告警功能:</span>
            <span class="alert-status-value ${config.enabled ? 'enabled' : 'disabled'}">
                ${config.enabled ? '已启用' : '已禁用'}
            </span>
        </div>
        <div class="alert-status-item">
            <span class="alert-status-label">监控状态:</span>
            <span class="alert-status-value ${config.isMonitoring ? 'monitoring' : 'disabled'}">
                ${config.isMonitoring ? '监控中' : '未监控'}
            </span>
        </div>
        <div class="alert-status-item">
            <span class="alert-status-label">当前错误数:</span>
            <span class="alert-status-value">${config.errorCount || 0}</span>
        </div>
        <div class="alert-status-item">
            <span class="alert-status-label">最后告警时间:</span>
            <span class="alert-status-value">${lastAlertTime}</span>
        </div>
        <div class="alert-status-item">
            <span class="alert-status-label">告警URL:</span>
            <span class="alert-status-value">${config.url || '未配置'}</span>
        </div>
    `;
}

// 显示告警配置
function showAlertConfig() {
    alertModal.classList.remove('hidden');
    loadAlertConfig();
}

// 隐藏告警配置
function hideAlertConfig() {
    alertModal.classList.add('hidden');
}

// 处理告警配置提交
async function handleAlertConfigSubmit(e) {
    e.preventDefault();
    
    try {
        const config = {
            enabled: alertEnabled.checked,
            url: alertUrl.value.trim(),
            interval: parseInt(alertInterval.value),
            threshold: parseInt(alertThreshold.value),
            cooldown: parseInt(alertCooldown.value)
        };
        
        const response = await fetch('/api/alert/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            const result = await response.json();
            alert('告警配置已保存');
            loadAlertConfig();
        } else {
            const error = await response.json();
            alert('保存失败: ' + error.error);
        }
    } catch (error) {
        console.error('保存告警配置失败:', error);
        alert('保存失败: ' + error.message);
    }
}

// 处理测试告警
async function handleTestAlert() {
    try {
        const response = await fetch('/api/alert/test', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            alert('测试告警已发送');
        } else {
            const error = await response.json();
            alert('测试失败: ' + error.error);
        }
    } catch (error) {
        console.error('测试告警失败:', error);
        alert('测试失败: ' + error.message);
    }
}

// 加载目录
async function loadDirectory() {
    try {
        showLoading(true);
        
        const response = await fetch(`/api/directory?path=${encodeURIComponent(currentPath)}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('获取目录失败');
        }
        
        const data = await response.json();
        
        currentPathSpan.textContent = data.currentPath || '/';
        renderFileList(data.items);
        
    } catch (error) {
        console.error('加载目录错误:', error);
        alert('加载目录失败: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// 渲染文件列表
function renderFileList(items) {
    fileList.innerHTML = '';
    
    // 添加返回上级目录选项
    if (currentPath) {
        const backItem = document.createElement('div');
        backItem.className = 'file-item directory';
        backItem.innerHTML = `
            <i class="fas fa-level-up-alt"></i>
            <span>..</span>
        `;
        backItem.addEventListener('click', () => {
            const pathParts = currentPath.split('/').filter(p => p);
            pathParts.pop();
            currentPath = pathParts.join('/');
            loadDirectory();
        });
        fileList.appendChild(backItem);
    }
    
    // 渲染文件和目录
    items.forEach(item => {
        const fileItem = document.createElement('div');
        fileItem.className = `file-item ${item.isDirectory ? 'directory' : 'file'}`;
        
        const icon = item.isDirectory ? 'fas fa-folder' : 'fas fa-file-alt';
        const size = item.size ? formatFileSize(item.size) : '';
        
        fileItem.innerHTML = `
            <i class="${icon}"></i>
            <span>${item.name}</span>
            <div class="file-info">${size}</div>
        `;
        
        fileItem.addEventListener('click', () => {
            if (item.isDirectory) {
                currentPath = item.path;
                loadDirectory();
            } else {
                selectFile(item.path);
            }
        });
        
        fileList.appendChild(fileItem);
    });
}

// 选择文件
function selectFile(filePath) {
    currentFile = filePath;
    currentPage = 1;
    currentKeyword = '';
    
    // 更新UI
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 找到对应的文件项并选中
    const fileItems = document.querySelectorAll('.file-item');
    for (let item of fileItems) {
        if (item.querySelector('span').textContent === filePath.split('/').pop()) {
            item.classList.add('selected');
            break;
        }
    }
    
    currentFileSpan.textContent = filePath;
    searchKeyword.value = '';
    loadLogs();
}

// 加载日志
async function loadLogs() {
    if (!currentFile) return;
    
    try {
        showLoading(true);
        
        const params = new URLSearchParams({
            file: currentFile,
            page: currentPage,
            limit: currentPageSize
        });
        
        if (currentKeyword) {
            params.append('keyword', currentKeyword);
        }
        
        const response = await fetch(`/api/logs?${params}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('获取日志失败');
        }
        
        const data = await response.json();
        
        renderLogs(data);
        updateFileInfo(data);
        updatePagination(data);
        
    } catch (error) {
        console.error('加载日志错误:', error);
        alert('加载日志失败: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// 渲染日志
function renderLogs(data) {
    logTableBody.innerHTML = '';
    
    data.logs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${log.lineNumber}</td>
            <td><span class="log-level ${log.level}">${log.level}</span></td>
            <td>${log.timestamp}</td>
            <td>${log.reqId}</td>
            <td class="log-url" title="${log.url}">${log.url}</td>
            <td class="log-message" title="${log.message}">${log.message}</td>
            <td>
                <button class="btn btn-sm btn-primary btn-showlogdetail" data-detail='${escapeHtml(log.raw)}'>
                    <i class="fas fa-eye"></i> 详情
                </button>
            </td>
        `;
        logTableBody.appendChild(row);
    });
}


document.addEventListener('click', (event) => {
    // 检查点击的元素是否匹配目标选择器
    if (event.target.matches('.btn-showlogdetail')) {
      // 处理点击事件的逻辑
      console.log('按钮被点击了');
      let detail = event.target.getAttribute('data-detail');
      showLogDetail(detail);
    }
});

// 更新文件信息
function updateFileInfo(data) {
    const size = formatFileSize(data.fileSize);
    const modified = new Date(data.lastModified).toLocaleString();
    fileInfo.innerHTML = `
        文件大小: ${size} | 
        总行数: ${data.totalLines} | 
        最后修改: ${modified}
    `;
}

// 更新分页信息
function updatePagination(data) {
    pageInfo.textContent = `第 ${data.currentPage} 页，共 ${data.totalPages} 页`;
    prevPage.disabled = data.currentPage <= 1;
    nextPage.disabled = data.currentPage >= data.totalPages;
}

// 处理搜索
function handleSearch() {
    currentKeyword = searchKeyword.value.trim();
    currentPage = 1;
    loadLogs();
}

async function handleDownload() {
    if (!currentFile) {
        alert('先选择日志文件');
        return;
    };

    const params = new URLSearchParams({
        file: currentFile,
    });

    const response = await fetch(`/api/download?${params}`, {
        headers: {
            'Authorization': `Bearer ${currentToken}`
        }
    });
    
    if (!response.ok) {
        throw new Error('获取日志失败');
    }
    // 读取文件名
    let filename = currentFile.split('/').pop();
    const cd = response.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename\*?=(?:UTF-8'')?("?)([^";]+)\1/);
    if (m && m[2]) filename = decodeURIComponent(m[2]);

    // 转为 blob 并触发浏览器下载
    const blob = await response.blob();
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
}

// 处理清除搜索
function handleClearSearch() {
    currentKeyword = '';
    searchKeyword.value = '';
    currentPage = 1;
    loadLogs();
}

// 处理页面大小变化
function handlePageSizeChange() {
    currentPageSize = parseInt(pageSize.value);
    currentPage = 1;
    loadLogs();
}

// 切换页面
function changePage(delta) {
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    loadLogs();
}

// 显示日志详情
function showLogDetail(rawLog) {
    let pretty = '';
    const tryPretty = (str) => {
        try {
            const obj = JSON.parse(str);
            return JSON.stringify(obj, null, 2);
        } catch {
            return null;
        }
    };

    // 1) 直接按整行 JSON 解析
    pretty = tryPretty(rawLog);

    // 2) 若失败，尝试提取首个 {...} 片段解析
    if (!pretty) {
        const match = rawLog.match(/\{[\s\S]*\}$/);
        if (match) pretty = tryPretty(match[0]);
    }

    // 3) 仍失败则原样展示
    logDetail.textContent = pretty || rawLog;
    logModal.classList.remove('hidden');
}

// 隐藏模态框
function hideModal() {
    logModal.classList.add('hidden');
}

// 显示/隐藏加载状态
function showLoading(show) {
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
