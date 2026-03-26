use tauri::AppHandle;

use crate::{anthropic, settings};

const SKETCH_MODEL: &str = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT: &str = r#"You are analyzing a hand-drawn map for a text-based MUD game.
Identify rooms (rectangles, squares, circles, or any enclosed shapes) and
connections (lines between shapes). Read any text labels as room names.

Assign each room a grid coordinate (gridX, gridY) based on spatial position:
- Leftmost rooms get the lowest gridX, topmost rooms get the lowest gridY
- Adjacent rooms should differ by 1 in gridX or gridY
- Diagonal adjacency is allowed

Return ONLY valid JSON with no markdown fences, no explanation, no extra text:
{
  "rooms": [
    { "id": "room_1", "label": "Entrance Hall", "gridX": 0, "gridY": 0 },
    { "id": "room_2", "label": null, "gridX": 1, "gridY": 0 }
  ],
  "connections": [
    { "from": "room_1", "to": "room_2" }
  ]
}"#;

const USER_PROMPT: &str = "Analyze this hand-drawn map. Identify all rooms and connections between them. Read any text labels written inside or near each shape.";

#[tauri::command]
pub async fn analyze_sketch(
    app: AppHandle,
    image_base64: String,
    media_type: String,
) -> Result<String, String> {
    let s = settings::get_settings(app).await?;

    if s.anthropic_api_key.is_empty() {
        return Err("Anthropic API key not configured. Set it in Settings.".to_string());
    }

    anthropic::complete_with_vision(
        &s.anthropic_api_key,
        SKETCH_MODEL,
        SYSTEM_PROMPT,
        USER_PROMPT,
        &image_base64,
        &media_type,
        4096,
    )
    .await
}
