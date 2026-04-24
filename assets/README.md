# CAD Map Assets

Drop your CAD-converted map mesh here as `map.gltf` or `map.glb`.

Supported first-pass format:
- `map.gltf` (supported and auto-detected)
- `map.glb` (recommended)
- You can also load another path via URL query: `?mapModel=/assets/your-file.gltf`
- You can also load another path via URL query: `?mapModel=/assets/your-file.glb`

Notes:
- This now drives a coarse collision proxy for movement and server hit validation when the GLTF is loaded.
- The renderer still falls back to the tile map if the proxy is unavailable.
- The default rotation/scale/offset for the model live in `assets/mapTransform.json` so you can adjust placement without touching code.
- Character model placement can be tuned in `assets/characterTransform.json` (rotation, targetHeight, scale, offset).
- Character appearance can also be tuned in `assets/characterTransform.json` (scale3, tintColor, emissiveColor, opacity, hideHead).
- Eye color can be separate from body color via `bodyTintColor`, `eyeTintColor`, `eyeEmissiveColor`, and `eyeMatch` tokens.
- For best results, export with Y-up and meters/world-units that roughly match the existing player scale.
- If you export `.gltf`, keep any companion `.bin` or texture files in the same folder so relative paths resolve correctly.
