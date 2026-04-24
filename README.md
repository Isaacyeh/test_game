This project is brought to you by some bored high school students.

This project is now a browser-based multiplayer 3D shooter using Babylon.js and WebGL, featuring:
- Real-time multiplayer via WebSockets
- Babylon.js 3D world rendering
- CAD map model support via GLTF/GLB

## CAD/3D map support (Babylon.js)

You can now load a GLTF or GLB map mesh into the Babylon world renderer:

1. Place your file at `assets/map.gltf` or `assets/map.glb`
2. Run `npm start`
3. Open the game

Optional: load a custom path with query string:

- `?mapModel=/assets/your-map.gltf`
- `?mapModel=/assets/your-map.glb`

Important current limitation:

- Collision and shot checks still use a simplified proxy derived from the imported GLTF when available.
- Tile-based fallback collision behavior still exists if the proxy has not loaded or the CAD file is unavailable.
- The map placement transform is defined in `assets/mapTransform.json`; use that file to rotate, scale, or offset the imported model.

How to run the code (for my less informed friends):

There are multiple ways to run the code.

1. Preview: You can download all the code directly off of Github then open index.html.
- This is an excelent way to preview the game, however this is only a single-player preview.
- If you want to play multi-player over the web, try the next few options.
2. Local host: Go to your preffered IDE, connect this repo and open a local host. step by step (simplest way):
- change the .com into .dev from the repo's link (github.com -> github.dev), this takes you to the github workspace (or vscode.dev) (or any other IDEs)
- then open terminal and open a codespace (this game requires node.js, which should be prebuilt in most IDEs)
- open terminal in the codespace again
- type "npm install" (just in case)
- then type "npm start"
- go to ports and chose either open preview or open in browser
- P.S. share the link to play with a friend
3. Server:
- ugg i dont feel like explaining, iykyk
- for personal use just use local host
- if you really feel like learning search up free web servers (i recommend render)

-IY
