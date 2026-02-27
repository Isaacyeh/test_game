// chat.js
// handles the on‑page chat UI and user interactions

import { setChatting } from "./input.js";
import { ws } from "./network.js";

const chat = document.getElementById("chat");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

function sendMessage() {
  const msg = chatInput.value.trim();
  if (!msg || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "chat", message: msg }));
  chatInput.value = "";
  chatInput.blur();
}

export function initChat() {
  sendBtn.addEventListener("click", sendMessage);

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  chatInput.addEventListener("focus", () => setChatting(true));
  chatInput.addEventListener("blur", () => setChatting(false));
}

export function addChatMessage(name, message) {
  const div = document.createElement("div");
  div.textContent = `${name}: ${message}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
