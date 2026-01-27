mod commands;

use std::sync::Arc;

use giga_command_center_core::AgentManager;
use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let manager = Arc::new(AgentManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(manager.clone())
        .invoke_handler(tauri::generate_handler![
            start_agent,
            stop_agent,
            stop_all_agents,
            list_agents,
            check_cli_available,
            check_cursor_cli_available,
            check_kilo_cli_available,
            check_gemini_cli_available,
            check_grok_cli_available,
            check_deepseek_cli_available,
            check_all_clis_available,
            list_skills,
            get_skill,
            get_config,
            set_config,
        ])
        .on_window_event({
            let manager = manager.clone();
            move |window, event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // Prevent window from closing immediately
                    api.prevent_close();
                    
                    let manager = manager.clone();
                    let window = window.clone();
                    
                    // Stop all agents before allowing window to close
                    tauri::async_runtime::spawn(async move {
                        manager.stop_all().await;
                        // Allow window to close after agents are stopped
                        let _ = window.close();
                    });
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
