// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

// Simple internationalization macro - returns the first parameter as-is for now
#[macro_export]
macro_rules! t {
    ($key:expr $(, $($name:expr => $value:expr),+)?) => {
        $key.to_string()
    };
}

// Declare modules
pub mod checkpoint;
pub mod claude_binary;
pub mod commands;
pub mod process;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
