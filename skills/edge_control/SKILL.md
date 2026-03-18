# Edge 浏览器控制

---
name: edge_control
description: Edge 浏览器控制技能：检测、启动、连接、操作、关闭 Edge 浏览器
version: 1.0.0
---

## 功能说明

使用 Puppeteer-core 远程控制 Microsoft Edge 浏览器，支持：

- 检测 Edge 是否已安装
- 查找运行中的 Edge 进程
- 使用指定调试端口启动 Edge
- 连接到已运行的 Edge（通过调试端口）
- 页面操作：导航、截图、执行 JS、获取内容
- 元素操作：点击、输入文本、等待
- 标签页管理：列出、切换
- 关闭 Edge 进程

## 参数说明

| 参数 | 类型 | 说明 | 必填 |
|------|------|------|------|
| action | string | 操作类型 | 是 |
| debugPort | integer | 调试端口，默认 9222 | 否 |
| host | string | 浏览器所在主机，默认 127.0.0.1 | 否 |
| url | string | URL | 否 |
| headless | boolean | 是否无头模式 | 否 |
| force | boolean | 强制关闭所有进程 | 否 |
| pid | integer | 进程 PID | 否 |
| selector | string | CSS 选择器 | 否 |
| text | string | 输入文本 | 否 |
| script | string | JavaScript 代码 | 否 |
| type | string | 内容类型/等待类型 | 否 |
| fullPage | boolean | 截取整个页面 | 否 |
| savePath | string | 截图保存路径 | 否 |
| timeout | integer | 超时时间(ms) | 否 |
| index | integer | 标签页索引 | 否 |

## 支持的操作

### detect
检测 Edge 浏览器是否已安装，返回安装路径。

### find_processes
查找正在运行的 Edge 进程。

### launch
使用指定调试端口启动 Edge 浏览器。

### connect
连接到已运行的 Edge 浏览器。

### close
关闭 Edge 浏览器进程。

### navigate
在已连接的浏览器中导航到指定 URL。

### screenshot
对页面进行截图。

### evaluate
在页面中执行 JavaScript 代码。

### get_content
获取页面内容。

### click
点击页面元素。

### type
在元素中输入文本。

### wait
等待页面元素或导航完成。

### list_tabs
列出所有打开的标签页。

### switch_tab
切换到指定的标签页。

### status
获取浏览器连接状态。

## 使用示例

```javascript
// 检测 Edge
{ action: 'detect' }

// 启动 Edge（调试端口 9222）
{ action: 'launch', debugPort: 9222, url: 'https://www.baidu.com' }

// 连接到已运行的 Edge
{ action: 'connect', debugPort: 9222 }

// 导航到 URL
{ action: 'navigate', url: 'https://www.google.com' }

// 截图
{ action: 'screenshot', savePath: 'C:\\temp\\screenshot.png' }

// 点击元素
{ action: 'click', selector: '#btn-submit' }

// 输入文本
{ action: 'type', selector: '#input-search', text: 'Hello World' }

// 执行 JavaScript
{ action: 'evaluate', script: 'document.title' }

// 关闭浏览器
{ action: 'close', force: true }
```

## 注意事项

1. 启动 Edge 时需要使用 `--remote-debugging-port` 参数
2. 连接前确保 Edge 已使用调试端口启动
3. Windows 上使用 `start` 命令启动浏览器（不阻塞）
4. 关闭浏览器时可以指定 PID 或强制关闭所有进程
