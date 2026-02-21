const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

/* --- Serve static files --- */
app.use(express.static(__dirname));

/* --- Multiplayer state --- */
const players = {};

/* --- WebSocket handling --- */
wss.on("connection", ws => {
  const id = Math.random().toString(36).slice(2);
  players[id] = { x: 2, y: 2, angle: 0 };

  ws.send(JSON.stringify({ id }));

  ws.on("message", msg => {
    players[id] = JSON.parse(msg);
    broadcast();
  });

  ws.on("close", () => {
    delete players[id];
    broadcast();
  });
});

function broadcast() {
  const data = JSON.stringify(players);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  });
}

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
