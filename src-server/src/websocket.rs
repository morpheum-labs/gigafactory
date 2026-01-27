use axum::{
    extract::{ws::WebSocketUpgrade, Extension},
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::broadcast;
use giga_command_center_core::AgentManager;

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    Extension(_manager): Extension<Arc<AgentManager>>,
    Extension(event_tx): Extension<Arc<broadcast::Sender<String>>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, event_tx))
}

async fn handle_socket(
    socket: axum::extract::ws::WebSocket,
    event_tx: Arc<broadcast::Sender<String>>,
) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = event_tx.subscribe();

    // Spawn task to send events to WebSocket
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(axum::extract::ws::Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Spawn task to receive messages from WebSocket
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let axum::extract::ws::Message::Close(_) = msg {
                break;
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = &mut send_task => {
            recv_task.abort();
            let _ = recv_task.await;
        },
        _ = &mut recv_task => {
            send_task.abort();
            let _ = send_task.await;
        },
    };
}
