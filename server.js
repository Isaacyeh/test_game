const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
 
const app = express();
const server = http.createServer(app);
 
// ── WebSocket server ──────────────────────────────────────────────────────────
// Do NOT pass { server } to WebSocket.Server if you want to handle the upgrade
// manually — but here we DO pass it so ws handles upgrades automatically.
// The key is that we also handle the 'upgrade' event on the http server to
// ensure Render's proxy correctly forwards WebSocket upgrades.
const wss = new WebSocket.Server({ noServer: true });
 
// Manually handle the HTTP upgrade so it works behind Render's proxy.
// When { server } is passed directly some proxies interfere; noServer + manual
// upgrade handling is more reliable on platforms like Render and Railway.
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
 
const PORT = process.env.PORT || 3000;
 
// ── Static files ──────────────────────────────────────────────────────────────
// Serve from __dirname but with explicit index so Render's health check gets
// a fast response from GET /
app.use(express.static(path.join(__dirname), { index: "index.html" }));
 
// ── Shared constants (must be kept in sync with script_files/constant.js) ───
const HIT_DAMAGE = 0.1;
const PLAYER_RADIUS = 0.2;
const PROJECTILE_RADIUS = 0.05;
const PROJECTILE_HIT_RADIUS = PLAYER_RADIUS + PROJECTILE_RADIUS; // 0.25
const PROJECTILE_HIT_RADIUS_Z = PLAYER_RADIUS + PROJECTILE_RADIUS;
const MAX_HEALTH = 1;
const MAX_PROJECTILES_PER_PLAYER = 20;
// ────────────────────────────────────────────────────────────────────────────
 
const SPAWN_INVINCIBILITY_MS = 3000; // 3 real seconds
 
const SPAWN = { x: 3, y: 17, angle: 0 };
 
const players      = {};
const processedHits = new Set();
 
// ── Broadcast throttle (20 Hz) ────────────────────────────────────────────────
let broadcastDirty = false;
 
setInterval(() => {
  if (broadcastDirty) {
    broadcastDirty = false;
    _doBroadcastPlayers();
  }
}, 1000 / 20);
 
// ── Helpers ───────────────────────────────────────────────────────────────────
function isFiniteNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}
 
function safeNum(v, fallback, min = -Infinity, max = Infinity) {
  return isFiniteNum(v) ? Math.min(max, Math.max(min, v)) : fallback;
}
 
function broadcastPlayers() {
  const now = Date.now();
  const cleanedPlayers = {};
  for (const id in players) {
    const p = players[id];
    cleanedPlayers[id] = {
      x:            p.x,
      y:            p.y,
      angle:        p.angle,
      z:            p.z,
      username:     p.username,
      projectiles:  p.projectiles || [],
      health:       p.health,
      sprite:       p.sprite,
      sneaking:     p.sneaking,
      // Derived state fields — used by the client for hitbox border color
      isDead:       p.health <= 0,
      isInvincible: now < (p.invincibleUntil || 0),
    };
  }
  const msg = JSON.stringify({ type: "players", players: out });
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) {
      try { c.send(msg); } catch (_) {}
    }
  });
}
 
function markDirty()         { broadcastDirty = true; }
function broadcastPlayersNow() { broadcastDirty = false; _doBroadcastPlayers(); }
 
function broadcastAll(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) {
      try { c.send(msg); } catch (_) {}
    }
  });
}
 
function broadcastChatImage(name, imageData) {
  const data = JSON.stringify({ type: "chatImage", name, imageData });
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  });
}
 
function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}
 
function checkProjectileHits() {
  const now = Date.now();
  for (const shooterId in players) {
    const projectiles = players[shooterId].projectiles || [];
 
    for (const projectile of projectiles) {
      if (
        !isFiniteNum(projectile.x)  ||
        !isFiniteNum(projectile.y)  ||
        !isFiniteNum(projectile.vx) ||
        !isFiniteNum(projectile.vy)
      ) continue;
 
      for (const victimId in players) {
        if (victimId === shooterId) continue;
        const victim = players[victimId];
        if (victim.health <= 0) continue;
        if (victim.inMenu) continue;
        if (now < (victim.invincibleUntil || 0)) continue;
 
        const hitKey = `${shooterId}:${proj.id}:${victimId}`;
        if (processedHits.has(hitKey)) continue;
 
        const prevX = projectile.x - projectile.vx;
        const prevY = projectile.y - projectile.vy;
        const xyDist = pointToSegmentDist(
          victim.x, victim.y,
          proj.x - proj.vx, proj.y - proj.vy,
          proj.x, proj.y
        );
        const zDistance = Math.abs((projectile.z || 0) - (victim.z || 0));
 
        if (xyDist <= PROJECTILE_HIT_RADIUS && zDistance <= PROJECTILE_HIT_RADIUS_Z) {
          victim.health = Math.max(0, Number((victim.health - HIT_DAMAGE).toFixed(3)));
          processedHits.add(hitKey);
        }
      }
    }
  }
 
  // Clean up stale hit keys
  const activeKeys = new Set();
  for (const shooterId in players) {
    for (const p of players[shooterId].projectiles || []) {
      for (const victimId in players) {
        activeKeys.add(`${shooterId}:${p.id}:${victimId}`);
      }
    }
  }
  const stale = [];
  for (const key of processedHits) {
    if (!activeKeys.has(key)) stale.push(key);
  }
  for (const key of stale) processedHits.delete(key);
}
 
// ── WebSocket keepalive (prevents Render proxy from dropping idle connections) ─
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);
 
// ── Connection handler ────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2);
  ws.id      = id;
  ws.isAlive = true;
 
  players[id] = {
    x:               SPAWN.x,
    y:               SPAWN.y,
    angle:           SPAWN.angle,
    z:               0,
    username:        ws.username,
    projectiles:     [],
    health:          MAX_HEALTH,
    sprite:          "/images/sprite1.png",
    invincibleUntil: 0,
    inMenu:          true,  // in sprite-select until confirmed
    sneaking:        false,
  };
 
  ws.send(JSON.stringify({ type: "init", id }));
 
  ws.on("error", (err) => {
    console.error(`WebSocket error for player ${id}:`, err.message);
  });
 
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }
 
    if (data.type === "chat") {
      const message = String(data.message || "").trim().slice(0, 300);
      if (message) broadcastChat(ws.username, message);
      return;
    }
 
    if (data.type === "chatImage") {
      // imageData is a base64 data URL — cap size to ~2 MB to prevent abuse
      const imageData = String(data.imageData || "");
      if (imageData.startsWith("data:image/") && imageData.length < 2_000_000) {
        broadcastChatImage(ws.username, imageData);
      }
      return;
    }
 
    if (data.type === "setName") {
      ws.username = String(data.name || "Anonymous").trim().slice(0, 32) || "Anonymous";
      if (players[id]) players[id].username = ws.username;
      return;
    }
 
      case "setName": {
        const name = String(data.name || "Anonymous").trim().slice(0, 32) || "Anonymous";
        if (players[id]) players[id].username = name;
        break;
      }
 
      case "setSprite": {
        if (players[id]) players[id].sprite = String(data.sprite || "").slice(0, 2048);
        break;
      }
 
    if (data.type === "menuClosed") {
      if (players[id]) {
        if (players[id].inMenu) {
          players[id].health = MAX_HEALTH;
          players[id].invincibleUntil = Date.now() + SPAWN_INVINCIBILITY_MS;
        }
        players[id].inMenu = false;
        broadcastPlayers();
      }
 
    if (data.type === "respawn") {
      if (players[id]) {
        players[id].health          = MAX_HEALTH;
        players[id].invincibleUntil  = Date.now() + SPAWN_INVINCIBILITY_MS;
        players[id].inMenu           = false;
        players[id].projectiles      = [];
        players[id].x                = SPAWN.x;
        players[id].y                = SPAWN.y;
        players[id].angle            = SPAWN.angle;
        players[id].z                = 0;
        broadcastPlayers();
      }
 
    // ── Default: position / projectile update ────────────────────────────────
    if (!players[id]) return;
 
    const prev = players[id];
    players[id] = {
      ...prev,
      x:        safeNum(data.x,     prev.x,     0, 200),
      y:        safeNum(data.y,     prev.y,     0, 200),
      angle:    safeNum(data.angle, prev.angle),
      z:        safeNum(data.z,     prev.z,     0,  10),
      sneaking: Boolean(data.sneaking),
      // Server-authoritative — never overwritten by client
      health:          prev.health,
      invincibleUntil: prev.invincibleUntil,
      inMenu:          prev.inMenu,
      username:        prev.username,
      sprite:          prev.sprite,
      projectiles: Array.isArray(data.projectiles)
        ? data.projectiles
            .slice(0, MAX_PROJECTILES_PER_PLAYER)
            .filter(
              (p) =>
                p !== null &&
                typeof p === "object" &&
                typeof p.id === "number" &&
                isFiniteNum(p.x)  &&
                isFiniteNum(p.y)  &&
                isFiniteNum(p.vx) &&
                isFiniteNum(p.vy)
            )
        : prev.projectiles,
    };
 
      default: {
        // Position / projectile update
        if (!players[id]) break;
        const prev = players[id];
        players[id] = {
          ...prev,
          x:        safeNum(data.x,     prev.x,     0, 200),
          y:        safeNum(data.y,     prev.y,     0, 200),
          angle:    safeNum(data.angle, prev.angle),
          z:        safeNum(data.z,     prev.z,     0,  10),
          sneaking: Boolean(data.sneaking),
          // Server-authoritative fields never overwritten by client
          health:          prev.health,
          invincibleUntil: prev.invincibleUntil,
          inMenu:          prev.inMenu,
          username:        prev.username,
          sprite:          prev.sprite,
          projectiles: Array.isArray(data.projectiles)
            ? data.projectiles.slice(0, MAX_PROJECTILES_PER_PLAYER).filter(
                (p) => p && typeof p === "object" && typeof p.id === "number" &&
                       isFiniteNum(p.x) && isFiniteNum(p.y) &&
                       isFiniteNum(p.vx) && isFiniteNum(p.vy)
              )
            : prev.projectiles,
        };
        checkProjectileHits();
        markDirty();
        break;
      }
    }
  });
 
  ws.on("close", () => {
    delete players[id];
    broadcastPlayersNow();
  });
});
 
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
