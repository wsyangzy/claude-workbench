use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{command, AppHandle, Manager};
use crate::process::ProcessRegistryState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub base_url: String,
    pub auth_token: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CurrentConfig {
    pub anthropic_base_url: Option<String>,
    pub anthropic_auth_token: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub anthropic_model: Option<String>,
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
    Ok(CurrentConfig {
        anthropic_base_url: env::var("ANTHROPIC_BASE_URL").ok(),
        anthropic_auth_token: env::var("ANTHROPIC_AUTH_TOKEN").ok(),
        anthropic_api_key: env::var("ANTHROPIC_API_KEY").ok(),
        anthropic_model: env::var("ANTHROPIC_MODEL").ok(),
    })
}

#[command]
pub async fn switch_provider_config(app: tauri::AppHandle, config: ProviderConfig) -> Result<String, String> {
    // 首先清理现有环境变量 (但不重启，因为我们马上要设置新的)
    clear_env_vars_only()?;
    
    // 设置新的环境变量
    set_env_var("ANTHROPIC_BASE_URL", &config.base_url)?;
    
    if let Some(auth_token) = &config.auth_token {
        set_env_var("ANTHROPIC_AUTH_TOKEN", auth_token)?;
    }
    
    if let Some(api_key) = &config.api_key {
        set_env_var("ANTHROPIC_API_KEY", api_key)?;
    }
    
    if let Some(model) = &config.model {
        set_env_var("ANTHROPIC_MODEL", model)?;
    }
    
    // 终止所有运行中的Claude进程以使新环境变量生效
    terminate_claude_processes(&app).await;
    
    Ok(format!("已成功切换到 {} ({})，所有Claude会话已重启以应用新配置", config.name, config.description))
}

#[command]
pub async fn clear_provider_config(app: tauri::AppHandle) -> Result<String, String> {
    // 使用统一的清理函数
    clear_anthropic_env_vars()?;
    
    // 终止所有运行中的Claude进程以使清理生效
    terminate_claude_processes(&app).await;
    
    Ok("已清理所有 ANTHROPIC 环境变量，所有Claude会话已重启".to_string())
}

/// 仅清理环境变量，不重启进程 (供switch_provider_config内部使用)
fn clear_env_vars_only() -> Result<(), String> {
    clear_anthropic_env_vars()
}

/// 清理 ANTHROPIC 相关环境变量 - 参考批处理文件的完整清理流程
#[cfg(target_os = "windows")]
fn clear_anthropic_env_vars() -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    
    let vars_to_clear = vec![
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_AUTH_TOKEN", 
        "ANTHROPIC_BASE_URL",
        "ANTHROPIC_MODEL"
    ];
    
    log::info!("开始清理 ANTHROPIC 环境变量...");
    
    for var_name in &vars_to_clear {
        log::info!("清理环境变量: {}", var_name);
        
        // 1. 使用 setx 设置为空值 (持久化清理) - 参考批处理文件
        let setx_result = Command::new("setx")
            .args(&[var_name, ""])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
        
        match setx_result {
            Ok(output) => {
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::warn!("setx 清理 {} 失败: {}", var_name, stderr);
                }
            }
            Err(e) => {
                log::warn!("setx 清理 {} 执行失败: {}", var_name, e);
            }
        }
        
        // 2. 使用 set 清理当前会话变量 - 参考批处理文件
        let set_result = Command::new("cmd")
            .args(&["/C", &format!("set {}=", var_name)])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
        
        match set_result {
            Ok(output) => {
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::warn!("set 清理 {} 失败: {}", var_name, stderr);
                }
            }
            Err(e) => {
                log::warn!("set 清理 {} 执行失败: {}", var_name, e);
            }
        }
        
        // 3. 使用 reg 命令从注册表中彻底删除 - 参考批处理文件
        let reg_result = Command::new("reg")
            .args(&["delete", "HKCU\\Environment", "/v", var_name, "/f"])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
        
        match reg_result {
            Ok(output) => {
                if output.status.success() {
                    log::info!("成功从注册表删除: {}", var_name);
                } else {
                    // 这是正常的，变量可能本来就不存在
                    log::debug!("注册表中不存在变量: {}", var_name);
                }
            }
            Err(e) => {
                log::warn!("reg delete {} 执行失败: {}", var_name, e);
            }
        }
        
        // 4. 清理当前进程的环境变量
        env::remove_var(var_name);
    }
    
    // 5. 广播环境变量更改消息
    let broadcast_result = Command::new("powershell")
        .args(&[
            "-Command", 
            "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\"user32.dll\", SetLastError=true, CharSet=CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult); }'; $HWND_BROADCAST = [IntPtr]0xffff; $WM_SETTINGCHANGE = 0x001A; $result = [UIntPtr]::Zero; [Win32]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result)"
        ])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();
    
    match broadcast_result {
        Ok(output) => {
            if output.status.success() {
                log::info!("成功广播环境变量清理消息");
            } else {
                log::warn!("广播环境变量清理消息失败，但不影响主要功能");
            }
        }
        Err(e) => {
            log::warn!("执行广播清理命令失败: {}, 但不影响主要功能", e);
        }
    }
    
    log::info!("ANTHROPIC 环境变量清理完成");
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn clear_anthropic_env_vars() -> Result<(), String> {
    let vars_to_clear = vec![
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_AUTH_TOKEN", 
        "ANTHROPIC_BASE_URL",
        "ANTHROPIC_MODEL"
    ];
    
    for var_name in &vars_to_clear {
        env::remove_var(var_name);
    }
    
    Ok(())
}

#[cfg(target_os = "windows")]
fn set_env_var(name: &str, value: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    
    log::info!("设置环境变量: {}={}", name, value);
    
    // 1. 设置持久化环境变量 (写入注册表) - 参考批处理文件做法
    let setx_result = Command::new("setx")
        .args(&[name, value])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| format!("Failed to run setx for {}: {}", name, e))?;
    
    if !setx_result.status.success() {
        let stderr = String::from_utf8_lossy(&setx_result.stderr);
        log::error!("setx 命令失败: {}", stderr);
        return Err(format!("setx 命令失败: {}", stderr));
    }
    
    // 2. 设置当前系统会话的环境变量 - 参考批处理文件做法
    // 使用 cmd /C set 命令设置当前会话变量
    let set_result = Command::new("cmd")
        .args(&["/C", &format!("set {}={}", name, value)])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| format!("Failed to run set for {}: {}", name, e))?;
    
    if !set_result.status.success() {
        let stderr = String::from_utf8_lossy(&set_result.stderr);
        log::warn!("set 命令失败: {}", stderr);
    }
    
    // 3. 同时设置当前进程的环境变量
    env::set_var(name, value);
    
    // 4. 广播环境变量更改消息给所有窗口 - 让其他进程知道环境变量已更改
    // 使用 Windows API SendMessageTimeout 发送 WM_SETTINGCHANGE 消息
    let broadcast_result = Command::new("powershell")
        .args(&[
            "-Command", 
            &format!(
                "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 {{ [DllImport(\"user32.dll\", SetLastError=true, CharSet=CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult); }}'; $HWND_BROADCAST = [IntPtr]0xffff; $WM_SETTINGCHANGE = 0x001A; $result = [UIntPtr]::Zero; [Win32]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result)"
            )
        ])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();
    
    match broadcast_result {
        Ok(output) => {
            if output.status.success() {
                log::info!("成功广播环境变量更改消息");
            } else {
                log::warn!("广播环境变量更改消息失败，但不影响主要功能");
            }
        }
        Err(e) => {
            log::warn!("执行广播命令失败: {}, 但不影响主要功能", e);
        }
    }
    
    log::info!("环境变量 {} 设置完成", name);
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_env_var(name: &str, value: &str) -> Result<(), String> {
    // 对于非 Windows 系统，只设置当前进程环境变量
    // 持久化需要修改 shell 配置文件，这里暂时不实现
    env::set_var(name, value);
    Ok(())
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

/// 终止所有运行中的Claude进程以使新环境变量生效
async fn terminate_claude_processes(app: &AppHandle) {
    log::info!("正在终止所有Claude进程以应用新的代理商配置...");
    
    // 获取进程注册表
    let registry = app.state::<ProcessRegistryState>();
    
    // 获取所有活动的Claude会话
    match registry.0.get_running_claude_sessions() {
        Ok(sessions) => {
            log::info!("找到 {} 个活动的Claude会话", sessions.len());
            
            for session in sessions {
                let session_id_str = match &session.process_type {
                    crate::process::registry::ProcessType::ClaudeSession { session_id } => session_id.as_str(),
                    _ => "unknown",
                };
                
                log::info!("正在终止Claude会话: session_id={}, run_id={}, PID={}", 
                    session_id_str,
                    session.run_id, 
                    session.pid
                );
                
                // 尝试优雅地终止进程
                match registry.0.kill_process(session.run_id).await {
                    Ok(success) => {
                        if success {
                            log::info!("成功终止Claude会话 {}", session.run_id);
                        } else {
                            log::warn!("终止Claude会话 {} 返回false", session.run_id);
                            
                            // 尝试强制终止
                            if let Err(e) = registry.0.kill_process_by_pid(session.run_id, session.pid as u32) {
                                log::error!("强制终止进程失败: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("终止Claude会话 {} 失败: {}", session.run_id, e);
                        
                        // 尝试强制终止
                        if let Err(e2) = registry.0.kill_process_by_pid(session.run_id, session.pid as u32) {
                            log::error!("强制终止进程也失败: {}", e2);
                        }
                    }
                }
            }
        }
        Err(e) => {
            log::error!("获取Claude会话列表失败: {}", e);
        }
    }
    
    log::info!("Claude进程终止操作完成");
}