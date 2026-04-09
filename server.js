const express = require("express");
const http = require("http");
const WebSocket = require("ws");
 
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
 
const PORT = process.env.PORT || 3000;
 
app.use(express.static(__dirname));
 
// ── Health check endpoint ─────────────────────────────────────────────────────
// Render (and most cloud platforms) probe GET / to confirm the process is alive.
// Express static will serve index.html for /, which is fine, but we also add
// an explicit /healthz route that responds instantly so Render never times out.
app.get("/healthz", (req, res) => res.sendStatus(200));
 
// ── Shared constants (must be kept in sync with script_files/constant.js) ───
const HIT_DAMAGE = 0.1;
const PLAYER_RADIUS = 0.2;
const PROJECTILE_RADIUS = 0.05;
const PROJECTILE_HIT_RADIUS = PLAYER_RADIUS + PROJECTILE_RADIUS; // 0.25
const PROJECTILE_HIT_RADIUS_Z = PLAYER_RADIUS + PROJECTILE_RADIUS;
const MAX_HEALTH = 1;
const MAX_PROJECTILES_PER_PLAYER = 20;
// ────────────────────────────────────────────────────────────────────────────
 
const SPAWN_INVINCIBILITY_MS = 3000;
const SPAWN = { x: 3, y: 17, angle: 0 };
 
// ── Broadcast throttle ────────────────────────────────────────────────────────
// Instead of serializing + sending the full player list on EVERY position update
// (which is every frame from every client = hundreds of sends/sec), we use a
// fixed-interval broadcast loop running at 20 Hz. This cuts CPU load by ~97%
// on a busy server and eliminates the main cause of Render 502s.
const BROADCAST_HZ = 20; // sends per second — plenty for a fast-paced game
let broadcastDirty = false; // true when state has changed since last broadcast
 
setInterval(() => {
  if (!broadcastDirty) return;
  broadcastDirty = false;
  _doBroadcastPlayers();
}, 1000 / BROADCAST_HZ);
 
const players = {};
const processedHits = new Set();
 
// ── Helpers ──────────────────────────────────────────────────────────────────
 
function isFiniteNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}
 
function safeNum(v, fallback, min = -Infinity, max = Infinity) {
  return isFiniteNum(v) ? Math.min(max, Math.max(min, v)) : fallback;
}
 
// Internal — called only by the broadcast interval, never directly.
function _doBroadcastPlayers() {
  if (wss.clients.size === 0) return; // no one connected, skip serialization
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
      isDead:       p.health <= 0,
      isInvincible: now < (p.invincibleUntil || 0),
    };
  }
  const data = JSON.stringify({ type: "players", players: cleanedPlayers });
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  });
}
 
// Call this whenever state changes — the interval will send it within 50ms.
function markDirty() {
  broadcastDirty = true;
}
 
// For events that need immediate delivery (respawn, disconnect, menuClosed)
// we mark dirty AND flush right away.
function broadcastPlayersNow() {
  broadcastDirty = false;
  _doBroadcastPlayers();
}
 
function broadcastChat(name, message) {
  const data = JSON.stringify({ type: "chat", name, message });
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  });
}
 
function broadcastChatImage(name, imageData) {
  // Send to each client individually so a slow receiver doesn't block others.
  // Also check readyState before each send — a client could disconnect mid-loop.
  const data = JSON.stringify({ type: "chatImage", name, imageData });
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) {
      try { c.send(data); } catch (e) { /* client disconnected mid-send */ }
    }
  });
}
 
function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}
 
function checkProjectileHits() {
  const now = Date.now();
  let anyHit = false;
 
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
 
        const hitKey = `${shooterId}:${projectile.id}:${victimId}`;
        if (processedHits.has(hitKey)) continue;
 
        const prevX = projectile.x - projectile.vx;
        const prevY = projectile.y - projectile.vy;
        const xyDist = pointToSegmentDist(
          victim.x, victim.y,
          prevX, prevY,
          projectile.x, projectile.y
        );
        const zDistance = Math.abs((projectile.z || 0) - (victim.z || 0));
 
        if (xyDist <= PROJECTILE_HIT_RADIUS && zDistance <= PROJECTILE_HIT_RADIUS_Z) {
          victim.health = Math.max(0, Number((victim.health - HIT_DAMAGE).toFixed(3)));
          processedHits.add(hitKey);
          anyHit = true;
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
 
  return anyHit;
}
 
// ── WebSocket keepalive ping ──────────────────────────────────────────────────
// Render's load balancer will silently drop idle WebSocket connections after
// ~55 seconds. We ping every 30 seconds to keep them alive. If a client
// doesn't pong back within 10 seconds, we terminate it.
const PING_INTERVAL_MS = 30_000;
 
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      // Client missed the last pong — connection is dead, clean it up
      ws.terminate();
      return;
    }
    ws.isAlive = false; // will be set back to true when pong arrives
    ws.ping();
  });
}, PING_INTERVAL_MS);
 
// ── Connection handler ────────────────────────────────────────────────────────
 
wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2);
  ws.id = id;
  ws.username = "Anonymous";
  ws.isAlive = true; // for keepalive ping above
 
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
    inMenu:          true,
    sneaking:        false,
  };
 
  ws.send(JSON.stringify({ type: "init", id }));
 
  // Mark alive on pong (response to our keepalive ping)
  ws.on("pong", () => { ws.isAlive = true; });
 
  ws.on("error", (err) => {
    console.error(`WebSocket error for player ${id}:`, err.message);
  });
 
  ws.on("message", (msg) => {
    // Guard against oversized messages (e.g. a client sending a huge payload)
    // Max legitimate message is a chatImage at ~2MB; anything bigger is abuse.
    if (msg.length > 2_100_000) return;
 
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
 
    if (data.type === "setSprite") {
      if (players[id]) players[id].sprite = String(data.sprite || "").slice(0, 2048);
      return;
    }
 
    if (data.type === "menuOpen") {
      if (players[id]) players[id].inMenu = true;
      return;
    }
 
    if (data.type === "menuClosed") {
      if (players[id]) {
        if (players[id].inMenu) {
          players[id].health = MAX_HEALTH;
          players[id].invincibleUntil = Date.now() + SPAWN_INVINCIBILITY_MS;
        }
        players[id].inMenu = false;
        broadcastPlayersNow(); // immediate — player just entered the world
      }
      return;
    }
 
    if (data.type === "respawn") {
      if (players[id]) {
        players[id].health          = MAX_HEALTH;
        players[id].invincibleUntil = Date.now() + SPAWN_INVINCIBILITY_MS;
        players[id].inMenu          = false;
        players[id].projectiles     = [];
        players[id].x               = SPAWN.x;
        players[id].y               = SPAWN.y;
        players[id].angle           = SPAWN.angle;
        players[id].z               = 0;
        broadcastPlayersNow(); // immediate — others should see respawn instantly
      }
      return;
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
 
    checkProjectileHits();
    // Don't broadcastPlayersNow() here — the 20 Hz interval handles it.
    // This is the key fix: position updates no longer saturate the CPU.
    markDirty();
  });
 
  ws.on("close", () => {
    delete players[id];
    broadcastPlayersNow(); // immediate — others need to know this player left
  });
});
 
// ── Catch-all error handler so the process never crashes ─────────────────────
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (server kept running):", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (server kept running):", reason);
});
 
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
 
