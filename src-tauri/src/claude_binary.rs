use anyhow::Result;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
/// Shared module for detecting Claude Code binary installations
/// Supports NVM installations, aliased paths, version-based selection, and bundled sidecars
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

/// Type of Claude installation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InstallationType {
    /// Bundled sidecar binary (preferred)
    Bundled,
    /// System-installed binary
    System,
    /// Custom path specified by user
    Custom,
}

/// Represents a Claude installation with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeInstallation {
    /// Full path to the Claude binary (or "claude-code" for sidecar)
    pub path: String,
    /// Version string if available
    pub version: Option<String>,
    /// Source of discovery (e.g., "nvm", "system", "homebrew", "where", "bundled")
    pub source: String,
    /// Type of installation
    pub installation_type: InstallationType,
}

/// Main function to find the Claude binary - Windows optimized version
/// Only uses system-installed Claude CLI, no bundled binaries
pub fn find_claude_binary(app_handle: &tauri::AppHandle) -> Result<String, String> {
    info!("Searching for system Claude CLI...");

    // First check if we have a stored path in the database
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        let db_path = app_data_dir.join("agents.db");
        if db_path.exists() {
            if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                if let Ok(stored_path) = conn.query_row(
                    "SELECT value FROM app_settings WHERE key = 'claude_binary_path'",
                    [],
                    |row| row.get::<_, String>(0),
                ) {
                    info!("Found stored claude path in database: {}", stored_path);
                    
                    // Verify the stored path still exists and is accessible
                    let path_buf = PathBuf::from(&stored_path);
                    if path_buf.exists() && path_buf.is_file() {
                        // Test if the binary is actually executable
                        if test_claude_binary(&stored_path) {
                            info!("Using cached Claude CLI path: {}", stored_path);
                            return Ok(stored_path);
                        } else {
                            warn!("Stored claude path exists but is not executable: {}", stored_path);
                            // Remove invalid cached path
                            let _ = conn.execute(
                                "DELETE FROM app_settings WHERE key = 'claude_binary_path'",
                                [],
                            );
                        }
                    } else {
                        warn!("Stored claude path no longer exists: {}", stored_path);
                        // Remove invalid cached path
                        let _ = conn.execute(
                            "DELETE FROM app_settings WHERE key = 'claude_binary_path'",
                            [],
                        );
                    }
                }
            }
        }
    }

    // Discover all available system installations
    let installations = discover_system_installations();

    if installations.is_empty() {
        error!("Could not find claude CLI in any location");
        return Err("Claude CLI not found. Please install Claude CLI using 'npm install -g @anthropic/claude' or ensure it's in your PATH".to_string());
    }

    // Log all found installations
    for installation in &installations {
        info!("Found Claude installation: {:?}", installation);
    }

    // Select the best installation (test each one for actual functionality)
    if let Some(best) = select_best_installation(installations) {
        info!(
            "Selected Claude installation: path={}, version={:?}, source={}",
            best.path, best.version, best.source
        );
        
        // Store the successful path in database for future use
        if let Err(e) = store_claude_path(app_handle, &best.path) {
            warn!("Failed to store claude path in database: {}", e);
        }
        
        Ok(best.path)
    } else {
        Err("No working Claude CLI installation found".to_string())
    }
}

/// Store Claude CLI path in database for future use
fn store_claude_path(app_handle: &tauri::AppHandle, path: &str) -> Result<(), String> {
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
            return Err(format!("Failed to create app data directory: {}", e));
        }
        
        let db_path = app_data_dir.join("agents.db");
        match rusqlite::Connection::open(&db_path) {
            Ok(conn) => {
                // Create table if it doesn't exist
                if let Err(e) = conn.execute(
                    "CREATE TABLE IF NOT EXISTS app_settings (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL
                    )",
                    [],
                ) {
                    return Err(format!("Failed to create settings table: {}", e));
                }
                
                // Store the path
                if let Err(e) = conn.execute(
                    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2)",
                    rusqlite::params!["claude_binary_path", path],
                ) {
                    return Err(format!("Failed to store claude path: {}", e));
                }
                
                info!("Stored claude path in database: {}", path);
                Ok(())
            }
            Err(e) => Err(format!("Failed to open database: {}", e)),
        }
    } else {
        Err("Failed to get app data directory".to_string())
    }
}

/// Test if a Claude binary is actually functional (Windows-only)
fn test_claude_binary(path: &str) -> bool {    
    debug!("Testing Claude binary at: {}", path);
    
    // Test with a simple --version command 
    let mut cmd = Command::new(path);
    cmd.arg("--version");
    
    // Add CREATE_NO_WINDOW flag on Windows to prevent terminal window popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    match cmd.output() {
        Ok(output) => {
            let success = output.status.success();
            debug!("Claude binary test result: success={}", success);
            success
        }
        Err(e) => {
            debug!("Failed to test Claude binary: {}", e);
            false
        }
    }
}

/// Discovers all available Claude installations and returns them for selection
/// This allows UI to show a version selector - System installations only
pub fn discover_claude_installations() -> Vec<ClaudeInstallation> {
    info!("Discovering all system Claude installations...");

    let mut installations = Vec::new();

    // Only discover system installations - no bundled sidecar
    installations.extend(discover_system_installations());

    // Sort by installation type, then by version (highest first), then by source preference
    installations.sort_by(|a, b| {
        match (&a.version, &b.version) {
            (Some(v1), Some(v2)) => {
                // Compare versions in descending order (newest first)
                match compare_versions(v2, v1) {
                    Ordering::Equal => {
                        // If versions are equal, prefer by source
                        source_preference(a).cmp(&source_preference(b))
                    }
                    other => other,
                }
            }
            (Some(_), None) => Ordering::Less, // Version comes before no version
            (None, Some(_)) => Ordering::Greater,
            (None, None) => source_preference(a).cmp(&source_preference(b)),
        }
    });

    installations
}

/// Returns a preference score for installation sources (lower is better)
fn source_preference(installation: &ClaudeInstallation) -> u8 {
    match installation.source.as_str() {
        "where" => 1,
        "homebrew" => 2,
        "system" => 3,
        source if source.starts_with("nvm") => 4,
        "local-bin" => 5,
        "claude-local" => 6,
        "npm-global" => 7,
        "yarn" | "yarn-global" => 8,
        "bun" => 9,
        "node-modules" => 10,
        "home-bin" => 11,
        "PATH" => 12,
        _ => 13,
    }
}

/// Discovers all Claude system installations on the system (Windows-only)
fn discover_system_installations() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();

    // 1. Try 'where' command on Windows
    if let Some(installation) = try_where_command() {
        installations.push(installation);
    }

    // 2. Try 'which' command (fallback, but not really needed on Windows)
    if let Some(installation) = try_which_command() {
        installations.push(installation);
    }

    // 3. Check NVM paths (Windows)
    installations.extend(find_nvm_installations());

    // 4. Check standard paths (Windows)
    installations.extend(find_standard_installations());

    // 5. Check Windows-specific paths
    installations.extend(find_windows_installations());

    // Remove duplicates by path
    let mut unique_paths = std::collections::HashSet::new();
    installations.retain(|install| unique_paths.insert(install.path.clone()));

    // Test each installation for actual functionality with timeout
    installations.retain(|install| {
        let is_functional = test_claude_binary(&install.path);
        if !is_functional {
            warn!("Claude installation at {} is not functional, removing from list", install.path);
        }
        is_functional
    });

    installations
}


/// Try using the 'where' command to find Claude on Windows
fn try_where_command() -> Option<ClaudeInstallation> {
    debug!("Trying 'where claude' to find binary...");

    let mut cmd = Command::new("where");
    cmd.arg("claude");
    
    // Add CREATE_NO_WINDOW flag on Windows to prevent terminal window popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    match cmd.output() {
        Ok(output) if output.status.success() => {
            let output_str = String::from_utf8_lossy(&output.stdout).trim().to_string();

            if output_str.is_empty() {
                return None;
            }

            // 'where' can return multiple paths, take the first one
            let path = output_str.lines().next()?.trim().to_string();

            debug!("'where' found claude at: {}", path);

            // Verify the path exists
            if !PathBuf::from(&path).exists() {
                warn!("Path from 'where' does not exist: {}", path);
                return None;
            }

            // Get version
            let version = get_claude_version(&path).ok().flatten();

            Some(ClaudeInstallation {
                path,
                version,
                source: "where".to_string(),
                installation_type: InstallationType::System,
            })
        }
        _ => None,
    }
}

/// Try using the system's path lookup command to find Claude
fn try_which_command() -> Option<ClaudeInstallation> {
    // Use Windows 'where' command only
    let command = "where";
    let arg = "claude";
    
    debug!("Trying '{}' to find claude binary...", command);

    let mut cmd = Command::new(command);
    cmd.arg(arg);
    
    // Add CREATE_NO_WINDOW flag on Windows to prevent terminal window popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    match cmd.output() {
        Ok(output) if output.status.success() => {
            let output_str = String::from_utf8_lossy(&output.stdout).trim().to_string();

            if output_str.is_empty() {
                return None;
            }

            // Parse aliased output: "claude: aliased to /path/to/claude"
            let path = if output_str.starts_with("claude:") && output_str.contains("aliased to") {
                output_str
                    .split("aliased to")
                    .nth(1)
                    .map(|s| s.trim().to_string())
            } else {
                Some(output_str)
            }?;

            debug!("'{}' found claude at: {}", command, path);

            // Verify the path exists
            if !PathBuf::from(&path).exists() {
                warn!("Path from '{}' does not exist: {}", command, path);
                return None;
            }

            // Get version
            let version = get_claude_version(&path).ok().flatten();

            Some(ClaudeInstallation {
                path,
                version,
                source: "where".to_string(),
                installation_type: InstallationType::System,
            })
        }
        _ => None,
    }
}

/// Find Claude installations in NVM directories (Windows-only)
fn find_nvm_installations() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();

    // Use USERPROFILE for Windows
    if let Ok(home) = std::env::var("USERPROFILE") {
        let nvm_dir = PathBuf::from(&home)
            .join(".nvm")
            .join("versions")
            .join("node");

        debug!("Checking NVM directory: {:?}", nvm_dir);

        if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    // Check both 'claude' and 'claude.cmd' for Windows
                    let claude_paths = [
                        entry.path().join("bin").join("claude"),
                        entry.path().join("bin").join("claude.cmd"),
                    ];

                    for claude_path in &claude_paths {
                        if claude_path.exists() && claude_path.is_file() {
                            let path_str = claude_path.to_string_lossy().to_string();
                            let node_version = entry.file_name().to_string_lossy().to_string();

                            debug!("Found Claude in NVM node {}: {}", node_version, path_str);

                            // Get Claude version
                            let version = get_claude_version(&path_str).ok().flatten();

                            installations.push(ClaudeInstallation {
                                path: path_str,
                                version,
                                source: format!("nvm ({})", node_version),
                                installation_type: InstallationType::System,
                            });
                            break; // Only add one per node version
                        }
                    }
                }
            }
        }
    }

    installations
}

/// Check standard installation paths (Windows-only)
fn find_standard_installations() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();

    // Windows-specific paths only
    let mut paths_to_check: Vec<(String, String)> = vec![];

    // Check user-specific paths for Windows
    if let Ok(home) = std::env::var("USERPROFILE") {
        paths_to_check.extend(vec![
            (
                format!("{}/.claude/local/claude", home),
                "claude-local".to_string(),
            ),
            (
                format!("{}/.local/bin/claude", home),
                "local-bin".to_string(),
            ),
            (
                format!("{}/.npm-global/bin/claude", home),
                "npm-global".to_string(),
            ),
            (format!("{}/.yarn/bin/claude", home), "yarn".to_string()),
            (format!("{}/.bun/bin/claude", home), "bun".to_string()),
            (format!("{}/bin/claude", home), "home-bin".to_string()),
            // Check common node_modules locations
            (
                format!("{}/node_modules/.bin/claude", home),
                "node-modules".to_string(),
            ),
            (
                format!("{}/.config/yarn/global/node_modules/.bin/claude", home),
                "yarn-global".to_string(),
            ),
            // Windows-specific paths
            (
                format!("{}/AppData/Roaming/npm/claude.cmd", home),
                "npm-global-windows".to_string(),
            ),
            (
                format!("{}/AppData/Roaming/npm/claude", home),
                "npm-global-windows".to_string(),
            ),
        ]);
    }

    // Check each path
    for (path, source) in paths_to_check {
        let path_buf = PathBuf::from(&path);
        if path_buf.exists() && path_buf.is_file() {
            debug!("Found claude at standard path: {} ({})", path, source);

            // Get version
            let version = get_claude_version(&path).ok().flatten();

            installations.push(ClaudeInstallation {
                path,
                version,
                source,
                installation_type: InstallationType::System,
            });
        }
    }

    // Check if claude is available in PATH (Windows)
    let claude_commands = vec!["claude", "claude.cmd"];

    for cmd in claude_commands {
        let mut command = Command::new(cmd);
        command.arg("--version");
        
        // Add CREATE_NO_WINDOW flag on Windows to prevent terminal window popup
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        
        if let Ok(output) = command.output() {
            if output.status.success() {
                debug!("{} is available in PATH", cmd);
                let version = extract_version_from_output(&output.stdout);

                installations.push(ClaudeInstallation {
                    path: cmd.to_string(),
                    version,
                    source: "PATH".to_string(),
                    installation_type: InstallationType::System,
                });
                break; // Only add one PATH entry
            }
        }
    }

    installations
}

/// Find Windows-specific Claude installations
fn find_windows_installations() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();

    // Windows-specific paths
    let mut paths_to_check: Vec<(String, String)> = vec![];

    // Check Program Files locations
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        paths_to_check.extend(vec![
            (format!("{}\\nodejs\\claude.cmd", program_files), "nodejs".to_string()),
            (format!("{}\\nodejs\\claude", program_files), "nodejs".to_string()),
        ]);
    }

    if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
        paths_to_check.extend(vec![
            (format!("{}\\nodejs\\claude.cmd", program_files_x86), "nodejs-x86".to_string()),
            (format!("{}\\nodejs\\claude", program_files_x86), "nodejs-x86".to_string()),
        ]);
    }

    // Check AppData locations
    if let Ok(appdata) = std::env::var("APPDATA") {
        paths_to_check.extend(vec![
            (format!("{}\\npm\\claude.cmd", appdata), "npm-appdata".to_string()),
            (format!("{}\\npm\\claude", appdata), "npm-appdata".to_string()),
        ]);
    }

    // Check each path
    for (path, source) in paths_to_check {
        let path_buf = PathBuf::from(&path);
        if path_buf.exists() && path_buf.is_file() {
            debug!("Found claude at Windows path: {} ({})", path, source);

            // Get version
            let version = get_claude_version(&path).ok().flatten();

            installations.push(ClaudeInstallation {
                path,
                version,
                source,
                installation_type: InstallationType::System,
            });
        }
    }

    installations
}
/// Get Claude version by running --version command (Windows-only)
fn get_claude_version(path: &str) -> Result<Option<String>, String> {
    debug!("Getting version for Claude at: {}", path);
    
    let mut cmd = Command::new(path);
    cmd.arg("--version");
    
    // Add CREATE_NO_WINDOW flag on Windows to prevent terminal window popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                let version = extract_version_from_output(&output.stdout);
                debug!("Successfully got version: {:?}", version);
                Ok(version)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                debug!("Claude version command failed with stderr: {}", stderr);
                Ok(None)
            }
        }
        Err(e) => {
            debug!("Failed to execute version command for {}: {}", path, e);
            Ok(None)
        }
    }
}

/// Extract version string from command output
fn extract_version_from_output(stdout: &[u8]) -> Option<String> {
    let output_str = String::from_utf8_lossy(stdout);
    
    // Debug log the raw output
    debug!("Raw version output: {:?}", output_str);
    
    // Use regex to directly extract version pattern (e.g., "1.0.41")
    // This pattern matches:
    // - One or more digits, followed by
    // - A dot, followed by
    // - One or more digits, followed by
    // - A dot, followed by
    // - One or more digits
    // - Optionally followed by pre-release/build metadata
    let version_regex = regex::Regex::new(r"(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?)").ok()?;
    
    if let Some(captures) = version_regex.captures(&output_str) {
        if let Some(version_match) = captures.get(1) {
            let version = version_match.as_str().to_string();
            debug!("Extracted version: {:?}", version);
            return Some(version);
        }
    }
    
    debug!("No version found in output");
    None
}

/// Select the best installation based on version
fn select_best_installation(installations: Vec<ClaudeInstallation>) -> Option<ClaudeInstallation> {
    // In production builds, version information may not be retrievable because
    // spawning external processes can be restricted. We therefore no longer
    // discard installations that lack a detected version – the mere presence
    // of a readable binary on disk is enough to consider it valid. We still
    // prefer binaries with version information when it is available so that
    // in development builds we keep the previous behaviour of picking the
    // most recent version.
    installations.into_iter().max_by(|a, b| {
        match (&a.version, &b.version) {
            // If both have versions, compare them semantically.
            (Some(v1), Some(v2)) => compare_versions(v1, v2),
            // Prefer the entry that actually has version information.
            (Some(_), None) => Ordering::Greater,
            (None, Some(_)) => Ordering::Less,
            // Neither have version info: prefer the one that is not just
            // the bare "claude" lookup from PATH, because that may fail
            // at runtime if PATH is modified.
            (None, None) => {
                if a.path == "claude" && b.path != "claude" {
                    Ordering::Less
                } else if a.path != "claude" && b.path == "claude" {
                    Ordering::Greater
                } else {
                    Ordering::Equal
                }
            }
        }
    })
}

/// Compare two version strings
fn compare_versions(a: &str, b: &str) -> Ordering {
    // Simple semantic version comparison
    let a_parts: Vec<u32> = a
        .split('.')
        .filter_map(|s| {
            // Handle versions like "1.0.17-beta" by taking only numeric part
            s.chars()
                .take_while(|c| c.is_numeric())
                .collect::<String>()
                .parse()
                .ok()
        })
        .collect();

    let b_parts: Vec<u32> = b
        .split('.')
        .filter_map(|s| {
            s.chars()
                .take_while(|c| c.is_numeric())
                .collect::<String>()
                .parse()
                .ok()
        })
        .collect();

    // Compare each part
    for i in 0..std::cmp::max(a_parts.len(), b_parts.len()) {
        let a_val = a_parts.get(i).unwrap_or(&0);
        let b_val = b_parts.get(i).unwrap_or(&0);
        match a_val.cmp(b_val) {
            Ordering::Equal => continue,
            other => return other,
        }
    }

    Ordering::Equal
}

/// Helper function to create a Command with proper Windows environment variables
pub fn create_command_with_env(program: &str) -> Command {
    let mut cmd = Command::new(program);

    // Inherit essential environment variables from parent process (Windows-focused)
    for (key, value) in std::env::vars() {
        // Pass through PATH and Windows-specific environment variables
        if key == "PATH"
            || key == "USERPROFILE"
            || key == "USER"
            || key == "USERNAME"
            || key == "COMPUTERNAME"
            || key == "APPDATA"
            || key == "LOCALAPPDATA"
            || key == "TEMP"
            || key == "TMP"
            || key == "NODE_PATH"
            || key == "NVM_DIR"
            || key == "NVM_BIN"
        {
            debug!("Inheriting env var: {}={}", key, value);
            cmd.env(&key, &value);
        }
    }

    // Add NVM support if the program is in an NVM directory (Windows style)
    if program.contains("\\.nvm\\versions\\node\\") || program.contains("/.nvm/versions/node/") {
        if let Some(node_bin_dir) = std::path::Path::new(program).parent() {
            // Ensure the Node.js bin directory is in PATH
            let current_path = std::env::var("PATH").unwrap_or_default();
            let node_bin_str = node_bin_dir.to_string_lossy();
            if !current_path.contains(&node_bin_str.as_ref()) {
                let new_path = format!("{};{}", node_bin_str, current_path); // Windows uses semicolon
                debug!("Adding NVM bin directory to PATH: {}", node_bin_str);
                cmd.env("PATH", new_path);
            }
        }
    }

    cmd
}

