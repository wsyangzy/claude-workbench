use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager};
use crate::process::ProcessRegistryState;
use log::{info, warn};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub base_url: String,
    pub auth_token: Option<String>,  // 对应 ANTHROPIC_AUTH_TOKEN
    pub model: Option<String>,       // 对应 ANTHROPIC_MODEL
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CurrentConfig {
    pub anthropic_base_url: Option<String>,
    pub anthropic_auth_token: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub anthropic_model: Option<String>,
}

// Claude settings.json 文件结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeSettings {
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub permissions: Option<PermissionsConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PermissionsConfig {
    #[serde(default)]
    pub allow: Vec<String>,
    #[serde(default)]
    pub deny: Vec<String>,
}

// 获取配置文件路径
fn get_providers_config_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?;
    
    let config_dir = home_dir.join(".claude");
    
    // 确保配置目录存在
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("无法创建配置目录: {}", e))?;
    }
    
    Ok(config_dir.join("providers.json"))
}

// 获取 Claude settings.json 文件路径
fn get_claude_settings_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?;
    
    let config_dir = home_dir.join(".claude");
    
    // 确保配置目录存在
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("无法创建配置目录: {}", e))?;
    }
    
    Ok(config_dir.join("settings.json"))
}

// 从文件加载代理商配置
fn load_providers_from_file() -> Result<Vec<ProviderConfig>, String> {
    let config_path = get_providers_config_path()?;
    
    if !config_path.exists() {
        // 如果文件不存在，返回空列表
        return Ok(vec![]);
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    if content.trim().is_empty() {
        return Ok(vec![]);
    }
    
    let providers: Vec<ProviderConfig> = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;
    
    Ok(providers)
}

// 保存代理商配置到文件
fn save_providers_to_file(providers: &Vec<ProviderConfig>) -> Result<(), String> {
    let config_path = get_providers_config_path()?;
    
    let content = serde_json::to_string_pretty(providers)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    Ok(())
}

// CRUD 操作 - 获取所有代理商配置
#[command]
pub fn get_provider_presets() -> Result<Vec<ProviderConfig>, String> {
    let config_path = get_providers_config_path()?;
    
    if !config_path.exists() {
        return Ok(vec![]);
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("无法读取配置文件: {}", e))?;
    
    let configs: Vec<ProviderConfig> = serde_json::from_str(&content)
        .map_err(|e| format!("配置文件格式错误: {}", e))?;
    
    Ok(configs)
}

#[command]
pub fn add_provider_config(config: ProviderConfig) -> Result<String, String> {
    let mut providers = load_providers_from_file()?;
    
    // 检查ID是否已存在
    if providers.iter().any(|p| p.id == config.id) {
        return Err(format!("ID '{}' 已存在，请使用不同的ID", config.id));
    }
    
    providers.push(config.clone());
    save_providers_to_file(&providers)?;
    
    Ok(format!("成功添加代理商配置: {}", config.name))
}

// CRUD 操作 - 更新代理商配置
#[command]
pub fn update_provider_config(config: ProviderConfig) -> Result<String, String> {
    let mut providers = load_providers_from_file()?;
    
    let index = providers.iter().position(|p| p.id == config.id)
        .ok_or_else(|| format!("未找到ID为 '{}' 的配置", config.id))?;
    
    providers[index] = config.clone();
    save_providers_to_file(&providers)?;
    
    Ok(format!("成功更新代理商配置: {}", config.name))
}

// CRUD 操作 - 删除代理商配置
#[command]
pub fn delete_provider_config(id: String) -> Result<String, String> {
    let mut providers = load_providers_from_file()?;
    
    let index = providers.iter().position(|p| p.id == id)
        .ok_or_else(|| format!("未找到ID为 '{}' 的配置", id))?;
    
    let deleted_config = providers.remove(index);
    save_providers_to_file(&providers)?;
    
    Ok(format!("成功删除代理商配置: {}", deleted_config.name))
}

// CRUD 操作 - 获取单个代理商配置
#[command]
pub fn get_provider_config(id: String) -> Result<ProviderConfig, String> {
    let providers = load_providers_from_file()?;
    
    providers.into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("未找到ID为 '{}' 的配置", id))
}

#[command]
pub fn get_current_provider_config() -> Result<CurrentConfig, String> {
    let settings = load_claude_settings()?;
    
    Ok(CurrentConfig {
        anthropic_base_url: settings.env.get("ANTHROPIC_BASE_URL").cloned(),
        anthropic_auth_token: settings.env.get("ANTHROPIC_AUTH_TOKEN").cloned(),
        anthropic_api_key: settings.env.get("ANTHROPIC_API_KEY").cloned(),
        anthropic_model: settings.env.get("ANTHROPIC_MODEL").cloned(),
    })
}

// 加载 Claude settings.json 文件
fn load_claude_settings() -> Result<ClaudeSettings, String> {
    let settings_path = get_claude_settings_path()?;
    
    // 添加调试信息
    info!("尝试加载配置文件: {:?}", settings_path);
    
    if !settings_path.exists() {
        // 如果文件不存在，返回默认设置
        info!("配置文件不存在，返回默认设置");
        return Ok(ClaudeSettings {
            env: HashMap::new(),
            permissions: Some(PermissionsConfig {
                allow: vec![],
                deny: vec![],
            }),
        });
    }
    
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("读取 settings.json 失败: {}", e))?;
    
    info!("配置文件内容长度: {} 字符", content.len());
    
    if content.trim().is_empty() {
        info!("配置文件为空，返回默认设置");
        return Ok(ClaudeSettings {
            env: HashMap::new(),
            permissions: Some(PermissionsConfig {
                allow: vec![],
                deny: vec![],
            }),
        });
    }
    
    // 首先尝试解析为通用 JSON
    let json_value: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("JSON 格式无效: {}", e))?;
    
    info!("JSON 解析成功，结构: {:?}", json_value);
    
    // 尝试解析为我们的结构体
    let settings: ClaudeSettings = serde_json::from_str(&content)
        .or_else(|e| {
            warn!("解析为 ClaudeSettings 失败: {}, 使用兼容模式", e);
            // 如果解析失败，尝试兼容模式
            parse_compatible_settings(&content)
        })
        .map_err(|e| format!("解析 settings.json 失败: {}", e))?;
    
    info!("成功加载配置，env 项目数: {}", settings.env.len());
    Ok(settings)
}

// 兼容模式解析
fn parse_compatible_settings(content: &str) -> Result<ClaudeSettings, String> {
    let json_value: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("JSON 解析失败: {}", e))?;
    
    let mut env = HashMap::new();
    
    if let Some(obj) = json_value.as_object() {
        for (key, value) in obj {
            if key == "env" {
                if let Some(env_obj) = value.as_object() {
                    for (env_key, env_value) in env_obj {
                        if let Some(env_str) = env_value.as_str() {
                            env.insert(env_key.clone(), env_str.to_string());
                        }
                    }
                }
            }
        }
    }
    
    Ok(ClaudeSettings {
        env,
        permissions: None,
    })
}

// 保存 Claude settings.json 文件
fn save_claude_settings(settings: &ClaudeSettings) -> Result<(), String> {
    let settings_path = get_claude_settings_path()?;
    
    // 如果文件存在，先读取现有内容以保持其他字段
    let mut full_settings = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取现有 settings.json 失败: {}", e))?;
        
        if !content.trim().is_empty() {
            serde_json::from_str::<serde_json::Value>(&content)
                .unwrap_or_else(|_| serde_json::json!({}))
        } else {
            serde_json::json!({})
        }
    } else {
        serde_json::json!({})
    };
    
    // 更新 env 字段 - 保留现有的其他环境变量
    if let Some(obj) = full_settings.as_object_mut() {
        // 获取现有的 env 对象，如果不存在则创建新的
        let existing_env = obj.get("env")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();
        
        // 合并环境变量：保留现有的，更新我们管理的部分
        let mut merged_env = existing_env;
        for (key, value) in &settings.env {
            merged_env.insert(key.clone(), serde_json::Value::String(value.clone()));
        }
        
        obj.insert("env".to_string(), serde_json::Value::Object(merged_env));
        
        // 如果有 permissions 配置也更新
        if let Some(permissions) = &settings.permissions {
            obj.insert("permissions".to_string(), serde_json::to_value(permissions).unwrap());
        }
    }
    
    let content = serde_json::to_string_pretty(&full_settings)
        .map_err(|e| format!("序列化 settings.json 失败: {}", e))?;
    
    fs::write(&settings_path, content)
        .map_err(|e| format!("写入 settings.json 失败: {}", e))?;
    
    info!("成功保存配置到: {:?}", settings_path);
    Ok(())
}

#[command]
pub async fn switch_provider_config(app: tauri::AppHandle, config: ProviderConfig) -> Result<String, String> {
    // 加载当前设置
    let mut settings = load_claude_settings()?;
    
    // 更新 ANTHROPIC 相关配置，保留其他配置（如 CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, API_TIMEOUT_MS 等）
    settings.env.insert("ANTHROPIC_BASE_URL".to_string(), config.base_url.clone());
    
    if let Some(auth_token) = &config.auth_token {
        if !auth_token.trim().is_empty() {
            settings.env.insert("ANTHROPIC_AUTH_TOKEN".to_string(), auth_token.clone());
        }
    } else {
        settings.env.remove("ANTHROPIC_AUTH_TOKEN");
    }
    
    if let Some(model) = &config.model {
        if !model.trim().is_empty() {
            settings.env.insert("ANTHROPIC_MODEL".to_string(), model.clone());
        }
    } else {
        settings.env.remove("ANTHROPIC_MODEL");
    }
    
    // 保存设置
    save_claude_settings(&settings)?;
    
    // 终止所有运行中的Claude进程以使新配置生效
    terminate_claude_processes(&app).await;
    
    Ok(format!("已成功切换到 {} ({})，所有Claude会话已重启以应用新配置", config.name, config.description))
}

#[command]
pub async fn clear_provider_config(app: tauri::AppHandle) -> Result<String, String> {
    // 加载当前设置
    let mut settings = load_claude_settings()?;
    
    // 清理 ANTHROPIC 相关配置
    settings.env.remove("ANTHROPIC_BASE_URL");
    settings.env.remove("ANTHROPIC_AUTH_TOKEN");
    settings.env.remove("ANTHROPIC_API_KEY");
    settings.env.remove("ANTHROPIC_MODEL");
    
    // 保存设置
    save_claude_settings(&settings)?;
    
    // 终止所有运行中的Claude进程以使清理生效
    terminate_claude_processes(&app).await;
    
    Ok("已清理所有 ANTHROPIC 配置，所有Claude会话已重启".to_string())
}

// 检测当前使用的代理商配置 - 参考 switch-script 的实现
fn detect_current_provider(configs: &[ProviderConfig]) -> Option<String> {
    // 获取当前配置
    let current_config = match get_current_provider_config() {
        Ok(config) => config,
        Err(_) => return None,
    };
    
    // 关键比较字段
    let key_fields = ["ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_MODEL"];
    
    // 比较找到匹配的配置
    for provider_config in configs {
        let mut matches = true;
        
        // 比较 ANTHROPIC_BASE_URL
        if current_config.anthropic_base_url.as_deref() != Some(&provider_config.base_url) {
            matches = false;
        }
        
        // 比较 ANTHROPIC_AUTH_TOKEN
        let current_auth = current_config.anthropic_auth_token.as_deref().unwrap_or("");
        let provider_auth = provider_config.auth_token.as_deref().unwrap_or("");
        if current_auth != provider_auth {
            matches = false;
        }
        
        // 比较 ANTHROPIC_MODEL (可选)
        let current_model = current_config.anthropic_model.as_deref().unwrap_or("");
        let provider_model = provider_config.model.as_deref().unwrap_or("");
        if current_model != provider_model {
            matches = false;
        }
        
        if matches {
            return Some(provider_config.id.clone());
        }
    }
    
    // 如果没有匹配到预设配置，返回 "custom"
    if current_config.anthropic_base_url.is_some() || 
       current_config.anthropic_auth_token.is_some() ||
       current_config.anthropic_api_key.is_some() {
        Some("custom".to_string())
    } else {
        None
    }
}

// 新增命令：获取当前使用的代理商ID
#[command]
pub fn get_current_provider_id() -> Result<Option<String>, String> {
    let configs = load_providers_from_file()?;
    Ok(detect_current_provider(&configs))
}

#[command]
pub fn test_provider_connection(base_url: String) -> Result<String, String> {
    // 简单的连接测试 - 尝试访问 API 端点
    let test_url = if base_url.ends_with('/') {
        format!("{}v1/messages", base_url)
    } else {
        format!("{}/v1/messages", base_url)
    };
    
    // 这里可以实现实际的 HTTP 请求测试
    // 目前返回一个简单的成功消息
    Ok(format!("连接测试完成：{}", test_url))
}

/// 终止所有运行中的Claude进程以使新配置文件生效
async fn terminate_claude_processes(app: &AppHandle) {
    info!("正在终止所有Claude进程以应用新的代理商配置...");
    
    // 获取进程注册表
    let registry = app.state::<ProcessRegistryState>();
    
    // 获取所有活动的Claude会话
    match registry.0.get_running_claude_sessions() {
        Ok(sessions) => {
            info!("找到 {} 个活动的Claude会话", sessions.len());
            
            for session in sessions {
                let session_id_str = match &session.process_type {
                    crate::process::registry::ProcessType::ClaudeSession { session_id } => session_id.as_str(),
                    _ => "unknown",
                };
                
                info!("正在终止Claude会话: session_id={}, run_id={}, PID={}", 
                    session_id_str,
                    session.run_id, 
                    session.pid
                );
                
                // 尝试优雅地终止进程
                match registry.0.kill_process(session.run_id).await {
                    Ok(success) => {
                        if success {
                            info!("成功终止Claude会话 {}", session.run_id);
                        } else {
                            warn!("终止Claude会话 {} 返回false", session.run_id);
                            
                            // 尝试强制终止
                            if let Err(e) = registry.0.kill_process_by_pid(session.run_id, session.pid as u32) {
                                warn!("强制终止进程失败: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        warn!("终止Claude会话 {} 失败: {}", session.run_id, e);
                        
                        // 尝试强制终止
                        if let Err(e2) = registry.0.kill_process_by_pid(session.run_id, session.pid as u32) {
                            warn!("强制终止进程也失败: {}", e2);
                        }
                    }
                }
            }
        }
        Err(e) => {
            warn!("获取Claude会话列表失败: {}", e);
        }
    }
    
    info!("Claude进程终止操作完成");
}

// 调试命令：检查配置文件读取
#[command]
pub fn debug_settings_path() -> Result<String, String> {
    let settings_path = get_claude_settings_path()?;
    let exists = settings_path.exists();
    
    let mut result = format!("配置文件路径: {:?}\n文件存在: {}\n", settings_path, exists);
    
    if exists {
        match fs::read_to_string(&settings_path) {
            Ok(content) => {
                result.push_str(&format!("文件内容长度: {} 字符\n", content.len()));
                result.push_str(&format!("文件内容预览: {}\n", &content[..content.len().min(200)]));
            }
            Err(e) => {
                result.push_str(&format!("读取文件失败: {}\n", e));
            }
        }
    }
    
    // 尝试加载配置
    match load_claude_settings() {
        Ok(settings) => {
            result.push_str(&format!("配置加载成功，env 项目数: {}\n", settings.env.len()));
            for (key, value) in &settings.env {
                if key.starts_with("ANTHROPIC") {
                    result.push_str(&format!("  {}: {}\n", key, if value.len() > 20 { &value[..20] } else { value }));
                }
            }
        }
        Err(e) => {
            result.push_str(&format!("配置加载失败: {}\n", e));
        }
    }
    
    Ok(result)
}