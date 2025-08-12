# Claude Workbench v1.0.0 发布说明 (Windows 专版)

## 🎉 项目开源发布

Claude Workbench 是一个专为 Windows 用户设计的 Claude CLI 桌面管理工具，现已正式开源！

### 🔗 项目链接
- **GitHub 仓库**: https://github.com/anyme123/claude-workbench
- **许可证**: MIT License
- **平台支持**: Windows 10/11 (64位)

## ✨ 核心特性

### 🛠️ 代理商管理系统（主要功能）
- **一键切换**: 静默切换不同的 Claude API 代理商，无弹窗打扰
- **完整 CRUD**: 添加、编辑、删除、查看代理商配置
- **隐私安全**: 本地 JSON 存储，零硬编码敏感信息
- **立即生效**: 自动重启 Claude 进程，配置立即生效
- **智能识别**: 自动检测和显示当前使用的配置
- **表单验证**: 完整的输入验证和错误处理

### 🎯 项目管理
- **可视化管理**: 直观的 Claude 项目管理界面
- **会话历史**: 完整的对话历史记录和检查点系统
- **项目隐藏**: 非破坏性的项目隐藏功能

### 🤖 智能代理
- **Agent 系统**: 支持 GitHub 集成和自动化任务
- **进程管理**: 智能的进程监控和管理
- **实时输出**: 流式显示执行结果

### 🌐 用户体验
- **多语言支持**: 中文优先的国际化界面
- **现代主题**: OKLCH 色彩空间的明暗主题切换
- **响应式设计**: 适配不同屏幕尺寸

## 🔧 技术架构

### 前端技术栈
- **React 18** + **TypeScript** - 现代化前端开发
- **Tailwind CSS 4** - 实用优先的样式框架
- **Framer Motion** - 流畅的动画效果
- **i18next** - 完整的国际化支持

### 后端技术栈
- **Tauri 2** - 现代桌面应用框架 (Windows 优化)
- **Rust** - 高性能系统编程语言
- **SQLite** - 嵌入式数据库
- **Windows API** - 原生 Windows 系统集成

## 🚀 快速开始

### 安装方式
1. **预构建版本**: 从 [Releases](https://github.com/anyme123/claude-workbench/releases) 下载 Windows 安装包
2. **源码构建**: 
   ```bash
   git clone https://github.com/anyme123/claude-workbench.git
   cd claude-workbench
   bun install
   bun run tauri build
   ```

### 使用指南
1. 启动应用后设置您的项目目录
2. 进入**设置** → **代理商**配置 API 提供商
3. 开始使用一键切换功能管理不同代理商

## 🤝 参与贡献

我们欢迎所有形式的贡献：
- **代码贡献**: Fork 仓库并提交 PR
- **问题报告**: 使用 GitHub Issues
- **功能建议**: 通过 GitHub Discussions
- **文档改进**: 帮助完善项目文档

详细信息请查看 [贡献指南](https://github.com/anyme123/claude-workbench/blob/main/CONTRIBUTING.md)。

## 📋 开发重点

### 已完成功能
- ✅ 完整的代理商管理系统
- ✅ 静默环境变量切换
- ✅ 自动进程重启机制
- ✅ 多语言国际化支持
- ✅ 现代化用户界面
- ✅ Windows 原生优化

### 计划功能
- 🔄 插件系统扩展
- 🔄 更多 MCP 服务器支持
- 🔄 高级会话管理功能
- 🔄 性能监控和优化

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

特别感谢：
- [Claude](https://claude.ai/) - 强大的 AI 助手
- [Tauri](https://tauri.app/) - 现代化桌面应用框架
- [React](https://react.dev/) - 用户界面构建库
- [Rust](https://rust-lang.org/) - 系统编程语言

---

**如果这个项目对您有帮助，请给我们一个 ⭐ Star！**

🔗 **项目地址**: https://github.com/anyme123/claude-workbench