use serde::Serialize;
use tauri::command;
use std::env;

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub version: String,
    pub database_path: String,
    pub latest_version: Option<String>,
    pub update_available: bool,
}

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub latest_version: String,
    pub current_version: String,
    pub update_available: bool,
    pub download_url: Option<String>,
    pub release_notes: Option<String>,
}

/// Get application version from Cargo.toml
#[command]
pub async fn get_app_version() -> Result<String, String> {
    let version = env!("CARGO_PKG_VERSION");
    Ok(version.to_string())
}

/// Get database location
#[command]
pub async fn get_database_path() -> Result<String, String> {
    // Get the app data directory
    let app_data_dir = dirs::data_dir()
        .ok_or("Failed to get app data directory")?;
    
    let db_path = app_data_dir
        .join("claude.workbench.app")
        .join("agents.db");
    
    Ok(db_path.to_string_lossy().to_string())
}

/// Get application information including version and database path
#[command]
pub async fn get_app_info() -> Result<AppInfo, String> {
    let version = get_app_version().await?;
    let database_path = get_database_path().await?;
    
    Ok(AppInfo {
        version,
        database_path,
        latest_version: None,
        update_available: false,
    })
}

/// Check for updates from GitHub releases
#[command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let current_version = get_app_version().await?;
    
    // GitHub API endpoint for releases
    let url = "https://api.github.com/repos/xinhai-ai/claude-suite/releases/latest";
    
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("User-Agent", "Claude-Suite")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release info: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("GitHub API returned status: {}", response.status()));
    }
    
    let release_data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let latest_version = release_data
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .trim_start_matches('v')
        .to_string();
    
    let download_url = release_data
        .get("assets")
        .and_then(|assets| assets.as_array())
        .and_then(|assets| assets.iter().find(|asset| {
            asset.get("name")
                .and_then(|name| name.as_str())
                .map(|name| name.ends_with(".exe") || name.ends_with(".msi"))
                .unwrap_or(false)
        }))
        .and_then(|asset| asset.get("browser_download_url"))
        .and_then(|url| url.as_str())
        .map(|url| url.to_string());
    
    let release_notes = release_data
        .get("body")
        .and_then(|body| body.as_str())
        .map(|notes| notes.to_string());
    
    // Simple version comparison (assumes semantic versioning)
    let update_available = compare_versions(&current_version, &latest_version);
    
    Ok(UpdateInfo {
        latest_version,
        current_version,
        update_available,
        download_url,
        release_notes,
    })
}

/// Compare two version strings (simple semantic version comparison)
fn compare_versions(current: &str, latest: &str) -> bool {
    let parse_version = |v: &str| -> Vec<u32> {
        v.split('.')
            .map(|part| part.parse().unwrap_or(0))
            .collect()
    };
    
    let current_parts = parse_version(current);
    let latest_parts = parse_version(latest);
    
    // Pad with zeros if needed
    let max_len = current_parts.len().max(latest_parts.len());
    let mut current_normalized = current_parts;
    let mut latest_normalized = latest_parts;
    
    current_normalized.resize(max_len, 0);
    latest_normalized.resize(max_len, 0);
    
    // Compare versions
    for (c, l) in current_normalized.iter().zip(latest_normalized.iter()) {
        if l > c {
            return true; // Update available
        } else if l < c {
            return false; // Current is newer
        }
    }
    
    false // Versions are equal
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_comparison() {
        assert!(compare_versions("1.0.0", "1.0.1"));
        assert!(compare_versions("1.0.0", "1.1.0"));
        assert!(compare_versions("1.0.0", "2.0.0"));
        assert!(!compare_versions("1.0.1", "1.0.0"));
        assert!(!compare_versions("1.1.0", "1.0.0"));
        assert!(!compare_versions("2.0.0", "1.0.0"));
        assert!(!compare_versions("1.0.0", "1.0.0"));
    }
}