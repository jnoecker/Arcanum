---
status: partial
phase: 09-scene-composition
source: [09-VERIFICATION.md]
started: 2026-04-06T02:05:00Z
updated: 2026-04-06T02:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Entity Picker sidebar with tabs and thumbnails
expected: Collapsible sidebar shows Rooms/Mobs/Items tabs populated from linked zone data, 32px thumbnails, searchable filter
result: [pending]

### 2. Room background auto-population
expected: Clicking a room in the picker sets it as scene background, image loads via Tauri IPC in 16:9 preview
result: [pending]

### 3. Entity preset positioning
expected: Added entities auto-distribute to front-center, left, right then back-row. Back-row entities render smaller (0.78x)
result: [pending]

### 4. Drag-to-reposition entities
expected: Pointer capture drag moves entity smoothly, position persists as percentage coordinates after release
result: [pending]

### 5. Entity selection and removal
expected: Click entity shows accent ring, Delete key or hover X button removes entity from scene
result: [pending]

### 6. Collapse/expand sidebar
expected: Sidebar collapses to thin strip with vertical "Entities" label, expands with smooth width transition
result: [pending]

### 7. Empty state preview
expected: Dark placeholder with dashed border, "Select a room to set the background" heading, directional chevron toward picker
result: [pending]

### 8. Undo entity operations
expected: Ctrl+Z reverses entity add, remove, and reposition operations correctly
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
