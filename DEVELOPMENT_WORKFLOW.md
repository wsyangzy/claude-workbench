# Claude Workbench 智能化开发工作流指南

> 基于深度项目分析生成的专业开发指导，配合 claude-workbench-expert subagent 使用

## 🚀 快速开始

### 使用专用 Subagent
```bash
# 启动专用开发助手
> Use the claude-workbench-expert subagent to [你的具体需求]
```

专用 subagent 已经深度理解项目架构，包含：
- ✅ **完整技术栈配置**: Tauri 2 + React 18 + TypeScript + Rust
- ✅ **Claude 4 并行优化**: 自动并行工具调用策略
- ✅ **项目特定工具**: 60+ 组件架构理解
- ✅ **常见问题解决**: 构建、Claude CLI、UI/UX 专家级支持

## 📋 智能开发流程

### Phase 1: 需求分析 (30秒)
```yaml
自动并行分析:
  项目状态检查:
    - Read: package.json, Cargo.toml, tauri.conf.json
    - Bash: "git status", "npm ls", "cargo check"
  
  相关代码扫描:
    - Grep: 需求相关的关键词和模式
    - Glob: 相关文件类型和组件
  
  技术资源查询:
    - mcp__Context7: 相关技术文档
    - mcp__tavily__tavily-search: 最佳实践和解决方案
```

### Phase 2: 方案设计 (1分钟)
```yaml
架构适配分析:
  前端方案 (React/TypeScript):
    - 组件设计: 基于现有60+组件模式
    - 状态管理: Context/hooks 或本地状态
    - UI集成: Radix UI + Tailwind CSS
    - 类型安全: TypeScript 接口定义
  
  后端方案 (Rust/Tauri):
    - 命令设计: #[command] 函数模式
    - 数据处理: SQLite + serde 序列化
    - 错误处理: Result<T, String> 模式
    - 异步处理: tokio 并发优化
  
  集成方案:
    - API通信: invoke() 类型安全调用
    - 数据流: Frontend ↔ Backend ↔ Database
    - 错误处理: 统一错误处理策略
```

### Phase 3: 并行实现 (主要开发时间)
```yaml
前端开发并行:
  - Write: React组件创建
  - Edit: 现有组件修改
  - mcp__Context7: React/TypeScript 文档查询
  - Bash: "npm run dev" 实时预览

后端开发并行:
  - Write: Rust命令实现
  - Edit: 现有命令修改  
  - mcp__Context7: Tauri/Rust 文档查询
  - Bash: "cargo check", "cargo test"

质量保证并行:
  - Bash: TypeScript类型检查
  - Bash: Rust代码格式化和Lint
  - Read: 错误日志和调试信息
```

### Phase 4: 测试验证 (集成测试)
```yaml
构建验证:
  - Bash: "npm run tauri build" (完整构建)
  - 验证: Windows兼容性检查
  - 测试: 核心功能端到端测试

功能验证:
  - Claude CLI 集成测试
  - MCP 服务器连接测试  
  - 代理商切换功能测试
  - UI/UX 交互测试
```

## 🎯 专业开发模式

### 1. Claude CLI 集成开发
```yaml
使用场景: 会话管理、CLI参数、进程处理
专家模式:
  - 并行检查: claude.rs + API接口 + 前端组件
  - 自动修复: 参数兼容性问题
  - 性能优化: 进程生命周期管理
  - 错误处理: Windows特定问题解决

关键文件:
  - src-tauri/src/commands/claude.rs (核心)
  - src/components/ClaudeCodeSession.tsx (UI)
  - src/lib/api.ts (API定义)
```

### 2. MCP 协议开发
```yaml
使用场景: 服务器管理、配置、连接测试
专家模式:
  - 并行开发: mcp.rs + MCPManager.tsx + 配置文件
  - 协议理解: Model Context Protocol 规范
  - 错误处理: 连接失败和重试机制
  - 用户体验: 直观的管理界面

关键文件:
  - src-tauri/src/commands/mcp.rs (核心)
  - src/components/MCPManager.tsx (UI)
  - .mcp.json (项目配置)
```

### 3. 代理商管理开发
```yaml
使用场景: API切换、配置管理、连接测试
专家模式:
  - 静默切换: 无弹窗的用户体验
  - 安全存储: 本地配置管理
  - 自动检测: 当前配置识别
  - 快速验证: 连接测试和状态显示

关键文件:
  - src-tauri/src/commands/provider.rs (核心)
  - src/components/ProviderManager.tsx (UI)
  - src/components/Settings.tsx (设置界面)
```

### 4. UI/UX 组件开发
```yaml
使用场景: 界面组件、主题、国际化
专家模式:
  - OKLCH色彩: 现代色彩空间支持
  - 响应式设计: 桌面应用适配
  - 中文优先: 国际化最佳实践
  - 无障碍支持: Radix UI 原生支持

关键技术:
  - Tailwind CSS 4.1.8 (样式)
  - Framer Motion (动画)
  - Radix UI (组件原语)
  - i18next (国际化)
```

## 🔧 智能工具使用

### 并行开发策略
```yaml
代码分析阶段:
  必须并行: Read + Grep + Glob (理解现有代码)
  可选并行: mcp__Context7 + mcp__tavily__tavily-search (技术查询)

开发实施阶段:
  必须并行: Write/Edit + 实时构建检查
  推荐并行: 前后端代码同时开发
  
测试验证阶段:
  必须并行: 多种测试类型同时执行
  系统验证: 构建 + 功能 + 性能测试
```

### 问题诊断流程
```yaml
1. 快速定位 (30秒):
   - 同时检查: 前端控制台 + 后端日志 + 构建输出
   - 并行验证: 配置文件 + 依赖状态 + 环境变量

2. 深度分析 (2分钟):
   - 代码审查: 相关文件的并行读取和分析
   - 历史对比: git diff 和变更记录
   - 文档查询: 技术栈相关文档

3. 解决实施 (主要时间):
   - 并行修复: 多个相关文件的同时修改
   - 实时验证: 修改后的即时测试
   - 回归检查: 确保不影响其他功能
```

## 📊 性能优化指南

### 前端性能
```typescript
// React 组件优化
const OptimizedComponent = React.memo(({ data }: Props) => {
  const memoizedValue = useMemo(() => expensiveCalculation(data), [data]);
  const handleClick = useCallback(() => { /* ... */ }, []);
  return <div>{memoizedValue}</div>;
});

// 虚拟滚动优化 (ClaudeCodeSession)
const rowVirtualizer = useVirtualizer({
  count: messages.length,
  estimateSize: () => 200,
  overscan: 8, // 性能优化参数
});
```

### 后端性能
```rust
// 异步并发优化
#[command]
async fn optimized_command() -> Result<String, String> {
    let (result1, result2) = tokio::join!(
        async_operation_1(),
        async_operation_2()
    );
    // 并行处理结果
}

// 数据库查询优化
async fn optimized_query(conn: &Connection) -> Result<Vec<Record>, Error> {
    // 使用索引和批量操作
    conn.prepare_cached("SELECT * FROM table WHERE indexed_column = ?")
}
```

### 构建优化
```bash
# 发布构建优化配置 (Cargo.toml)
[profile.release]
opt-level = "z"      # 体积优化
lto = true           # 链接时优化
strip = true         # 符号剥离
codegen-units = 1    # 单线程代码生成
```

## 🚨 常见问题快速解决

### 构建问题
```yaml
症状: "页面文件太小，无法完成操作"
原因: Rust工具链损坏或虚拟内存不足
解决: 
  - rustup update
  - cargo clean
  - 重启开发环境

症状: 跨设备兼容性问题
原因: 使用了开发模式构建
解决: 必须使用 "npm run tauri build" + bun
```

### Claude CLI 问题
```yaml
症状: "unknown option '--resume-project'"
原因: 使用了不存在的CLI参数
解决: 使用正确参数 (-c 继续, --resume sessionId 恢复)

症状: 会话输出不滚动
原因: 虚拟滚动配置或自动滚动逻辑
解决: 检查 ClaudeCodeSession.tsx 的滚动机制
```

### UI/UX 问题
```yaml
症状: 主题切换异常
原因: OKLCH色彩空间浏览器兼容性
解决: 检查目标浏览器支持 (Chrome 88+, Firefox 113+)

症状: 中文字体显示问题
原因: 字体回退链配置
解决: 验证 Tailwind 配置中的中文字体栈
```

## 🎯 高效开发技巧

### 1. 智能代码导航
```bash
# 快速定位核心功能
grep -r "execute_claude_code" src-tauri/  # 找到Claude CLI集成
grep -r "FloatingPromptInput" src/        # 找到输入组件
grep -r "MCPManager" src/                 # 找到MCP管理
```

### 2. 并行调试策略
```yaml
前端调试:
  - 浏览器开发者工具 (React DevTools)
  - Console 错误和警告监控
  - Network 标签的API调用跟踪

后端调试:
  - Rust cargo 日志输出
  - Tauri 进程管理监控
  - 数据库操作日志

系统调试:
  - 任务管理器进程监控
  - 文件系统权限检查
  - 网络连接状态验证
```

### 3. 版本控制最佳实践
```bash
# 分支管理
git checkout -b feature/new-functionality
git checkout -b fix/claude-cli-parameters
git checkout -b ui/theme-improvements

# 提交规范
git commit -m "feat: 添加新功能"
git commit -m "fix: 修复Claude CLI参数问题"
git commit -m "ui: 优化主题切换体验"
```

## 📚 技术资源速查

### 核心文档
- **Tauri 2**: https://v2.tauri.app/
- **React 18**: https://react.dev/
- **TypeScript**: https://www.typescriptlang.org/
- **Rust**: https://doc.rust-lang.org/

### 项目特定资源
- **Radix UI**: https://www.radix-ui.com/
- **Tailwind CSS**: https://tailwindcss.com/
- **Framer Motion**: https://www.framer.com/motion/
- **SQLite Rust**: https://docs.rs/rusqlite/

### Windows 开发
- **Windows API**: https://docs.microsoft.com/en-us/windows/win32/
- **Process Management**: CreateProcess, 进程生命周期
- **File System**: Windows路径处理, UNC路径支持

## 🚀 未来发展方向

### 技术演进
1. **AI集成扩展**: 支持更多AI模型和API提供商
2. **插件架构**: 可扩展的功能插件系统
3. **云端同步**: 跨设备配置和会话同步
4. **高级MCP**: 更丰富的MCP服务器生态集成

### 用户体验提升
1. **智能助手**: 内置开发助手和问题诊断
2. **可视化调试**: 图形化的调试和监控界面
3. **自定义工作流**: 用户定义的开发流程
4. **团队协作**: 多人协作的项目管理功能

---

**记住**: 始终使用 `claude-workbench-expert` subagent 来获得最专业的开发支持！它已经深度理解项目的每个技术细节，能够提供最高效的解决方案。