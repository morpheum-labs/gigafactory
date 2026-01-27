mod routes;
mod websocket;

use std::sync::Arc;
use std::path::PathBuf;
use axum::{
    extract::Extension,
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use giga_command_center_core::AgentManager;
use tokio::sync::broadcast;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Create shared state
    let manager = Arc::new(AgentManager::new());
    
    // Create broadcast channel for WebSocket events
    let (event_tx, _) = broadcast::channel::<String>(1000);
    let event_tx = Arc::new(event_tx);

    // Determine static file directory
    // Try environment variable first, then relative paths
    let static_dir = std::env::var("STATIC_DIR")
        .map(PathBuf::from)
        .or_else(|_| {
            // Try relative to current directory
            let dist = PathBuf::from("dist");
            if dist.exists() {
                Ok(dist)
            } else {
                // Try relative to src-server (for development)
                let dist = PathBuf::from("../dist");
                if dist.exists() {
                    Ok(dist)
                } else {
                    // Fallback to dist in current dir even if it doesn't exist
                    Ok(PathBuf::from("dist"))
                }
            }
        })
        .unwrap_or_else(|_: std::env::VarError| PathBuf::from("dist"));

    tracing::info!("Serving static files from: {}", static_dir.display());

    // Build application with routes
    let app = Router::new()
        // API routes
        .route("/api/agents", post(routes::start_agent))
        .route("/api/agents/:id", axum::routing::delete(routes::stop_agent))
        .route("/api/agents", get(routes::list_agents))
        .route("/api/agents/all", axum::routing::delete(routes::stop_all_agents))
        .route("/api/cli/check/:cli", get(routes::check_cli_available))
        .route("/api/skills", get(routes::list_skills))
        .route("/api/skills/:name", get(routes::get_skill))
        .route("/api/config", get(routes::get_config))
        .route("/api/config", post(routes::set_config))
        // WebSocket route
        .route("/ws", get(websocket::websocket_handler))
        // Static file serving (for frontend)
        .nest_service("/", ServeDir::new(static_dir))
        // Add CORS
        .layer(CorsLayer::permissive())
        // Add shared state
        .layer(Extension(manager))
        .layer(Extension(event_tx));

    // Start server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("Failed to bind to address");
    
    tracing::info!("Server listening on http://0.0.0.0:3000");
    
    axum::serve(listener, app)
        .await
        .expect("Server failed to start");
}
