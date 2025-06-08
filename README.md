# 梦晚的脚手架

适用于各大操作系统的脚手架

**如何使用?**

```javascript
npm i -g mac-mw-cli-dev
mac-mw-cli-dev -h // 查看各种命令
```

## 核心功能

- 前置检查 包含版本号 环境变量,root 权限等检查
- 动态加载 init 命令 + 缓存 + Node 多进程执行命令
- 动态增加静态模版/自定义模版等多种模版,支持插件化配置模版
- 自动安装最新模版,并将模版项目自动运行
- 手写 inquirerList,ejs,require 等源码
- publish 实现 包含所有的 git 自动化操作
- 云发布和云构建
