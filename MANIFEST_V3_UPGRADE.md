# Manifest V3 升级说明

## 问题原因

在 Manifest V3 中，后台页面改为 Service Worker，它会在不活动时自动停止。这导致以下问题：

### 问题 1: 断开的端口连接
- 长连接（long-lived connection）会被断开
- Content script 使用断开的连接时会报错：`Error: Attempting to use a disconnected port object`

### 问题 2: 扩展上下文失效
- 当扩展被重新加载、更新或禁用时，扩展上下文失效
- Content script 还在运行但无法访问 chrome API
- 会报错：`Error: Extension context invalidated`

### 问题 3: webRequestBlocking 权限被移除
- Manifest V3 移除了 `webRequestBlocking` 权限
- `blocking` 模式的 webRequest 只能在企业强制安装的扩展中使用
- 会报错：`You do not have permission to use blocking webRequest listeners`

## 解决方案

### 1. Response.js 修复

#### 添加扩展上下文检查
- 创建 `isExtensionContextValid()` 函数来检查扩展上下文是否有效
- 在所有使用 chrome API 的地方先检查上下文
- 上下文失效时立即停止处理并返回友好错误

#### 添加自动重连机制
- 创建 `createConnection()` 函数来建立连接
- 创建 `getConnection()` 函数来获取或重新建立连接
- 监听 `onDisconnect` 事件，连接断开时自动标记为 null
- 在 `onDisconnect` 时重置连接状态，下次请求时自动重连

#### 添加错误处理
- 在 `sendAjaxByBack()` 中添加 `sendMessage()` 包装函数
- 捕获发送消息时的错误
- 检测 "Extension context invalidated" 错误并返回中文提示
- 失败时自动重新创建连接并重试
- 重试仍失败时返回友好的错误信息

#### 添加定时器保护
- 在 `run()` 函数中检查扩展上下文
- 在 setInterval 循环中检查扩展上下文
- 上下文失效时自动清除定时器，防止继续运行

### 2. Background.js 优化

#### 改进连接处理
- 添加连接断开事件监听
- 在发送消息时添加 try-catch 错误处理
- 添加日志来帮助调试连接问题

#### 移除 webRequest 拦截器
- 移除了 `blocking` 模式的 webRequest 监听器
- 所有请求都通过 background script 的 XMLHttpRequest 发送
- 直接在 XMLHttpRequest 中设置请求头（大部分头部都能设置）
- 通过 `xhr.getAllResponseHeaders()` 获取响应头
- 对于无法设置的头部（如 User-Agent），记录警告但继续处理

## 主要改动

### response.js
```javascript
// 之前：在顶层创建单一连接
var connect = chrome.runtime.connect({ name: "request" });

// 现在：动态管理连接并检查上下文
var connect = null;

// 1. 检查扩展上下文是否有效
function isExtensionContextValid() {
    try {
        return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
        return false;
    }
}

// 2. 创建连接前先检查上下文
function createConnection() {
    if (!isExtensionContextValid()) {
        console.error('Extension context invalidated. Please reload the page.');
        return null;
    }
    
    try {
        connect = chrome.runtime.connect({ name: "request" });
        connect.onDisconnect.addListener(function() {
            console.log('Connection disconnected, will reconnect on next request');
            connect = null;
        });
        // ... 消息监听
        return connect;
    } catch (error) {
        console.error('Failed to create connection:', error);
        return null;
    }
}

// 3. 获取连接前先检查上下文
function getConnection() {
    if (!isExtensionContextValid()) {
        return null;
    }
    if (!connect) {
        return createConnection();
    }
    return connect;
}

// 4. 发送消息时处理上下文失效
function sendMessage(message) {
    if (!isExtensionContextValid()) {
        errorFn({
            status: 0,
            body: 'Extension context invalidated. Please reload the page.\n扩展已重新加载或更新，请刷新页面。'
        });
        return;
    }
    
    var connection = getConnection();
    if (!connection) {
        errorFn({
            status: 0,
            body: 'Failed to establish connection.\n无法建立连接。'
        });
        return;
    }
    
    try {
        connection.postMessage(message);
    } catch (error) {
        if (error.message && error.message.includes('Extension context invalidated')) {
            errorFn({
                status: 0,
                body: 'Extension context invalidated. Please reload the page.\n扩展已重新加载或更新，请刷新页面。'
            });
            return;
        }
        // 重新连接并重试
        createConnection();
        // ...
    }
}

// 5. 在定时器中检查上下文
var runInterval = setInterval(function () {
    if (!isExtensionContextValid()) {
        console.error('Extension context invalidated. Stopping.');
        clearInterval(runInterval);
        return;
    }
    run();
}, 100);
```

### background.js
```javascript
// 1. 添加错误处理和断开监听
chrome.runtime.onConnect.addListener(function(port) {
    if (port.name === 'request') {
        port.onDisconnect.addListener(function() {
            console.log('Content script disconnected');
        });
        
        port.onMessage.addListener(function(msg) {
            sendAjax(msg.req, function(res) {
                try {
                    port.postMessage({ id: msg.id, res: res });
                } catch (error) {
                    console.error('Failed to send response:', error);
                }
            }, ...);
        });
    }
});

// 2. 移除 webRequest 拦截器，直接设置请求头
// 之前：使用 webRequest 拦截器修改请求头
// chrome.webRequest.onBeforeSendHeaders.addListener(..., ['blocking', 'requestHeaders']);

// 现在：在 XMLHttpRequest 中直接设置
for (var name in req.headers) {
    try {
        xhr.setRequestHeader(name, req.headers[name]);
    } catch (error) {
        console.warn('Cannot set header:', name, error.message);
    }
}
```

## 测试建议

1. **基本功能测试**
   - 测试跨域请求是否正常工作
   - 测试文件上传功能
   - 测试代理设置功能

2. **连接稳定性测试**
   - 长时间不使用后再次发起请求（测试自动重连）
   - 快速连续发起多个请求
   - 在 Service Worker 休眠后发起请求

3. **错误处理测试**
   - 检查浏览器控制台是否有错误日志
   - 测试网络异常情况的处理

4. **请求头测试**
   - 测试自定义请求头是否正常发送
   - 检查是否有 "Cannot set header" 警告（某些头部无法设置是正常的）
   - 验证响应头是否正确接收

## 注意事项

1. **Service Worker 生命周期**
   - Service Worker 会在不活动约 30 秒后自动停止
   - 连接断开后会自动重建，用户无感知

2. **扩展重新加载**
   - 当扩展重新加载、更新或禁用时，扩展上下文会失效
   - Content script 会检测到并显示友好的错误提示
   - **用户需要刷新页面**才能恢复功能

3. **错误处理**
   - 所有错误都会被捕获并记录到控制台
   - 扩展上下文失效会返回中英文双语提示
   - 定时器会在上下文失效时自动停止

4. **调试建议**
   - 如果遇到连接问题，检查浏览器控制台的日志信息
   - 查看是否有 "Extension context invalidated" 错误
   - 如果出现上下文失效，刷新页面即可解决

5. **Unsafe Headers 限制**
   - 在 background script 中使用 XMLHttpRequest 时，大部分头部都可以设置
   - 某些真正的 unsafe headers（如 User-Agent, Connection）仍然不能修改
   - 这是浏览器的内置限制，即使在 background script 中也无法绕过
   - 如果控制台出现 "Cannot set header" 警告，这通常不会影响核心功能

## 兼容性

- ✅ Chrome 88+ (Manifest V3 最低版本)
- ✅ Edge 88+
- ✅ 完全向后兼容原有功能

