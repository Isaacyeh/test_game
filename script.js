import { update } from "./script_files/player.js";
import { setupChat } from "./script_files/chat.js";
import { render } from "./script_files/render/render.js";
import { castRay } from "./script_files/render/castRay.js";
import { drawMinimap } from "./script_files/render/minimap.js";

const keys = {};
onkeydown = (e) => (keys[e.key] = true);
onkeyup = (e) => (keys[e.key] = false);

// chat elements
const chat = document.getElementById("chat");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
// WebSocket
const wsProtocol = location.protocol === "https:" ? "wss://" : "ws://";
const ws = new WebSocket(wsProtocol + location.host);

setupChat(ws, chatInput, chat, sendBtn, username);

// NETWORK EVENTS (idk what this does, might need it)
/*
ws.addEventListener("message", (e) => {
  const data = JSON.parse(e.data);
  if (data.type === "init") myId = data.id;
  if (data.type === "players") others = { ...data.players };
});
*/
function loop() {
  update();
  render(drawMinimap(), castRay(rayAngle));
}

loop();
