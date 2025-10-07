# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Cross-Request 是一个为 Chrome 浏览器设计的扩展插件，主要功能是为 HTML 页面提供跨域请求能力，特别为 YApi 接口测试工具提供支持。该插件已升级到 Manifest V3。

## 核心架构

### 主要文件结构
- `manifest.json` - Manifest V3 配置文件
- `background.js` - Service Worker，处理跨域请求的核心逻辑
- `index.js` - 注入到页面的内容脚本，提供 `crossRequest` API
- `response.js` - 响应处理器，管理页面与 background script 的通信
- `popup.js` - 扩展弹窗的逻辑，管理 URL 白名单和代理设置
- `jquery-3.1.1.js` - jQuery 库依赖

### 通信机制
插件采用三层架构：
1. **页面层** (`index.js`): 暴露 `crossRequest` API 给页面使用
2. **通信层** (`response.js`): 管理页面与 background script 的连接，处理扩展上下文失效问题
3. **服务层** (`background.js`): 在 Service Worker 中执行实际的跨域请求

## 开发指南

### 常用开发任务

#### 加载和调试扩展
```bash
# 1. 打开 Chrome 扩展管理页面
chrome://extensions/

# 2. 启用开发者模式并加载已解压的扩展程序
# 选择项目根目录

# 3. 修改代码后需要重新加载扩展
# 点击扩展页面的"重新加载"按钮

# 4. 刷新使用插件的页面（重要！）
# 扩展重新加载后必须刷新页面才能恢复功能
```

#### 查看调试信息
- **Background script**: 在 `chrome://extensions` 页面点击"Service Worker"链接
- **Content script**: 在目标页面打开开发者工具（F12），查看 Console 标签
- **网络请求**: 在开发者工具的 Network 标签查看实际请求

### 关键技术点

#### 扩展上下文失效处理
这是 Manifest V3 的常见问题，当扩展重新加载时会发生。代码中已实现完整的检测和恢复机制：

```javascript
// 检查扩展上下文是否有效
function isExtensionContextValid() {
    try {
        return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
        return false;
    }
}
```

#### 自动重连机制
由于 Service Worker 会自动休眠，连接可能断开。response.js 中实现了自动重连：

```javascript
function getConnection() {
    if (!isExtensionContextValid()) {
        return null;
    }
    if (!connect) {
        return createConnection();
    }
    return connect;
}
```

#### 文件上传支持
插件支持两种文件上传方式：
1. **普通文件上传**: 通过 DOM 元素 ID 获取文件
2. **Base64 文件上传**: 支持 YApi 的 base64 文件格式

```javascript
// 处理 base64 文件
if (typeof item.value === 'string' && /data.*base64/.test(item.value)) {
    formDatas.append(item.name, dataURLtoFile(item.value, 'file'));
}
```

## 测试建议

### 基本功能测试
1. 在 YApi 中测试跨域 GET/POST 请求
2. 测试文件上传功能（包括 base64 格式）
3. 测试代理设置功能（通过 GTest-Proxy 头部）

### 错误场景测试
1. 扩展重新加载后的行为（应显示友好错误提示）
2. Service Worker 休眠后的自动重连
3. 网络异常和超时处理

### 常见问题解决
- **"Extension context invalidated"**: 刷新页面即可解决
- **连接失败**: 检查扩展是否正确加载，查看控制台日志
- **请求头设置失败**: 某些头部（如 User-Agent）无法修改是正常现象

## 重要注意事项

1. **每次修改代码后**：必须重新加载扩展 **并** 刷新使用插件的页面
2. **调试时**：同时关注 background script 和 content script 的控制台输出
3. **兼容性**：代码已完全兼容 Manifest V3，无需考虑 V2 向后兼容
4. **安全性**：插件只处理跨域请求，不涉及敏感信息处理

## 版本信息
- Manifest Version: 3
- 最低 Chrome 版本: 88+
- 支持浏览器: Chrome, Edge 88+