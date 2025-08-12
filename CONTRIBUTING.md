# 贡献指南

感谢您对 Claude Workbench 项目的关注！我们欢迎所有形式的贡献，无论是代码、文档、测试还是反馈。

## 🚀 快速开始

### 开发环境设置

1. **克隆仓库**
   ```bash
   git clone https://github.com/anyme123/claude-workbench.git
   cd claude-workbench
   ```

2. **安装依赖**
   ```bash
   bun install  # 推荐使用 bun
   # 或者
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run tauri dev
   ```

### 系统要求

- Node.js 18+ (推荐 LTS 版本)
- Rust 1.70+ (通过 `rustup` 安装)
- 系统特定依赖：
  - Windows: Visual Studio Build Tools
  - macOS: Xcode Command Line Tools
  - Linux: `build-essential`, `libwebkit2gtk-4.0-dev` 等

## 📝 开发规范

### 代码风格

#### Frontend (React/TypeScript)
- 使用 TypeScript 严格模式
- 组件使用 PascalCase 命名
- 函数和变量使用 camelCase
- 使用函数式组件和 Hooks
- 优先使用组合而非继承

```typescript
// 好的示例
interface UserProps {
  name: string;
  email?: string;
}

const UserCard: React.FC<UserProps> = ({ name, email }) => {
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div className="p-4 border rounded">
      <h3>{name}</h3>
      {email && <p>{email}</p>}
    </div>
  );
};
```

#### Backend (Rust)
- 遵循 Rust 标准命名约定
- 使用 `cargo fmt` 格式化代码
- 使用 `cargo clippy` 进行代码检查
- 优先使用 `Result<T, E>` 进行错误处理

```rust
// 好的示例
#[tauri::command]
pub async fn get_project_info(project_id: String) -> Result<ProjectInfo, String> {
    let project = load_project(&project_id)
        .map_err(|e| format!("Failed to load project: {}", e))?;
    
    Ok(project.into())
}
```

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type):**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具变动

**示例:**
```
feat(provider): add one-click provider switching

- Implement CRUD operations for provider management
- Add silent execution for environment variable setting
- Auto-restart Claude processes on provider switch

Fixes #123
```

## 🐛 报告问题

### Bug 报告
使用 [Bug 报告模板](https://github.com/anyme123/claude-workbench/issues/new?template=bug_report.md) 并包含：

- **环境信息**: 操作系统、版本、Node.js/Rust 版本
- **重现步骤**: 详细的步骤说明
- **期望行为**: 应该发生什么
- **实际行为**: 实际发生了什么
- **日志文件**: 相关的错误日志
- **截图**: 如果适用

### 功能请求
使用 [功能请求模板](https://github.com/anyme123/claude-workbench/issues/new?template=feature_request.md) 并描述：

- **问题描述**: 当前的问题或限制
- **解决方案**: 建议的解决方案
- **替代方案**: 考虑过的其他方案
- **用例**: 具体的使用场景

## 🔧 开发流程

### 1. Fork 和分支

1. Fork 仓库到您的 GitHub 账户
2. 创建功能分支：
   ```bash
   git checkout -b feature/amazing-feature
   # 或者
   git checkout -b fix/issue-number
   ```

### 2. 开发和测试

1. **编写代码**
   - 遵循项目的代码风格
   - 添加必要的注释
   - 确保类型安全

2. **运行测试**
   ```bash
   # Frontend 测试
   npm test
   
   # Backend 测试
   cd src-tauri && cargo test
   
   # 端到端测试
   npm run test:e2e
   ```

3. **代码检查**
   ```bash
   # TypeScript 检查
   npm run type-check
   
   # Rust 检查
   cd src-tauri && cargo clippy
   
   # 格式化
   npm run format
   cd src-tauri && cargo fmt
   ```

### 3. 提交和 PR

1. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

2. **推送到您的 Fork**
   ```bash
   git push origin feature/amazing-feature
   ```

3. **创建 Pull Request**
   - 使用清晰的标题和描述
   - 关联相关的 Issue
   - 包含变更的截图（如适用）

## 📚 项目结构

```
claude-workbench/
├── src/                    # React 前端代码
│   ├── components/         # UI 组件
│   ├── hooks/             # 自定义 Hooks
│   ├── contexts/          # React Context
│   ├── lib/               # 工具函数和 API
│   └── i18n/              # 国际化资源
├── src-tauri/             # Rust 后端代码
│   ├── src/
│   │   ├── commands/      # Tauri 命令
│   │   ├── process/       # 进程管理
│   │   └── main.rs        # 入口文件
│   └── Cargo.toml         # Rust 依赖配置
├── public/                # 静态资源
└── docs/                  # 项目文档
```

## 🎯 开发重点

### 当前优先级
1. **功能完善**: 核心功能的稳定性和可用性
2. **用户体验**: 界面优化和交互改进
3. **性能优化**: 启动速度和响应性能
4. **国际化**: 多语言支持的完善
5. **测试覆盖**: 自动化测试的增加

### 技术债务
- 组件的单元测试覆盖
- API 错误处理的统一化
- 性能监控和优化
- 无障碍访问性改进

## 🤝 社区

- **讨论**: [GitHub Discussions](https://github.com/anyme123/claude-workbench/discussions)
- **问题**: [GitHub Issues](https://github.com/anyme123/claude-workbench/issues)

## 📜 行为准则

请阅读并遵守我们的 [行为准则](CODE_OF_CONDUCT.md)。我们致力于创建一个欢迎所有人的友好社区。

---

再次感谢您的贡献！每个贡献都让 Claude Workbench 变得更好。