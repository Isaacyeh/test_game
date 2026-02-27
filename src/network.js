// network.js
// wraps the websocket connection and related events

import { addChatMessage } from "./chat.js";
import { others, player, setMyId } from "./player.js";

export let ws;

export function initNetwork() {
  const wsProtocol = location.protocol === "https:" ? "wss://" : "ws://";
  ws = new WebSocket(wsProtocol + location.host);

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "setName", name: player.username }));
  });

  ws.addEventListener("message", (e) => {
    const data = JSON.parse(e.data);

    if (data.type === "init") {
      setMyId(data.id);
    }
    if (data.type === "players") {
      Object.assign(others, data.players);
    }

    if (data.type === "chat") {
      addChatMessage(data.name, data.message);
    }
  });
}

export function sendPlayerState(state) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(state));
  }
}
