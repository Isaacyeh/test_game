import { initPlayer, update, getState, setMyId, setOthers, syncHealthFromServer } from "./script_files/player.js";
import { setupChat } from "./script_files/chat.js";
import { render } from "./script_files/render/render.js";
 
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});
 
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
 
const chat = document.getElementById("chat");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
 
const wsProtocol = location.protocol === "https:" ? "wss://" : "ws://";
const ws = new WebSocket(wsProtocol + location.host);
 
const { username } = getState();
setupChat(ws, chatInput, chat, sendBtn, username);
initPlayer(keys, ws);
 
ws.addEventListener("message", (e) => {
  const data = JSON.parse(e.data);
  if (data.type === "init") setMyId(data.id);
  if (data.type === "players") {
    setOthers(data.players);
    syncHealthFromServer(data.players);
  }
});
 
function loop() {
  update();
  render(canvas, ctx);
  requestAnimationFrame(loop);
}
 
loop();
