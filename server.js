const express = require("express");
const http = require("http");
const fs = require("fs");
const WebSocket = require("ws");
const path = require("path");
 
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
 
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
 
const PORT = process.env.PORT || 3000;
 
// Static files
app.use(express.static(path.join(__dirname), { index: "index.html" }));
 
// ── Constants — must match client constant.js ─────────────────────────────────
const HIT_DAMAGE            = 0.1;
const PLAYER_RADIUS         = 0.2;
const PROJECTILE_RADIUS     = 0.025;
const PROJECTILE_HIT_RADIUS = PLAYER_RADIUS + PROJECTILE_RADIUS; // 0.225
const PROJECTILE_HIT_RADIUS_Z = PLAYER_RADIUS + PROJECTILE_RADIUS;
const DEFAULT_SPRITE_ASPECT = 0.5;
const MAX_HEALTH            = 1;
const MAX_PROJECTILES_PER_PLAYER = 20;
const TRACER_MAX_RANGE      = 18;
const RAY_STEP              = 0.05;
const PITCH_SCREEN_Y_SCALE  = 0.75;
const PROJECTILE_START_Z    = 0.5;
const SPAWN_INVINCIBILITY_MS = 5_000;
const MAX_REMOTE_SPRITE_URL_LENGTH = 4096;
const MAX_INLINE_SPRITE_DATA_URL_LENGTH = 350_000;
const MAX_CHAT_IMAGE_DATA_URL_LENGTH = 350_000;
const BROADCAST_HZ = safeNum(Number(process.env.BROADCAST_HZ), 30, 10, 120);
const CAD_TRANSFORM_PATH = path.join(__dirname, "assets", "mapTransform.json");
const DEFAULT_CAD_MODEL_TRANSFORM = {
  rotationX: -Math.PI / 2,
  rotationY: 0,
  rotationZ: 0,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
};
 
const SPAWN = { x: 3, y: 17, angle: 0 };

function getPlayerHitBoxXY(victim) {
  const aspect = safeNum(victim?.spriteAspect, DEFAULT_SPRITE_ASPECT, 0.05, 8);
  return {
    halfWidth: PLAYER_RADIUS * aspect,
    halfHeight: PLAYER_RADIUS,
  };
}
 
// ── Map import (Node-compatible version of map.js) ────────────────────────────
// We duplicate only what the server needs: the map array and isWall logic.
// Keep this in sync with script_files/map.js.
const maps = [
  [
    "------------------------------####-----------------------------------",
    "---------------##############-#--#-----------------------------------",
    "---------------#------------###-##-----------------------------------",
    "---------------#-----------------#-----------------------------------",
    "---------------#-#----------###--#-----------------------------------",
    "---------------#-#----------#-#--#-----------------------------------",
    "--------########-#######----#-#--#-----------------------------------",
    "--------#--------#-----##-###-#--####################----------------",
    "--------#--#####-#-#####---#-##--#------------------#----------------",
    "--------#--#---#-###---#---#-#----------------------#----------------",
    "--------#--#---#-----------#-#####------------------#-#####----------",
    "--------#--#---###-----#---###---#############---######---#----------",
    "-------##--#######-#####---------#-----------#------------#----------",
    "-------#-----------#---#---###---#-----------#-----####---##---------",
    "#########--#########---#####-#--##-----------#-----#--#----#---------",
    "#------------####-####---#####--#------------#-----#--#----#---------",
    "#------------#--#-#--#---#------##############-----#--#----#---------",
    "#---------------###--#####-------------------------#--#----#---------",
    "#------------#---#---------------------------------#--#----#---------",
    "##########---#---------------------------##############----#---------",
    "#--------#---######----------------------#----------#-----##---------",
    "#--------#---#---###-######--------------#----------#-----#----------",
    "#--------#---#---#----##--#--------------#----------#-----#########--",
    "#--------#---#---#-----#--#############-##----------##------------##-",
    "#--------#--##---#-----#------------#----#-----------#-------------##",
    "#--------#--##--###-####------------#----#-----------#--------------#",
    "#--------#---#--#-----#########-----##--##-----------#-------###-####",
    "#--------#---####--------#----#------#-###############-------#------#",
    "#--------#--------------------#-----##-----------------------#------#",
    "#--------#---#-----------#----#-----#-----------##############------#",
    "#--------#####--#-----#--#---##-----#-----------#-------------------#",
    "#------------#--#-----#--#---#------#-----------#-------------------#",
    "#------------#--#######--#---########----------------#--#-----------#",
    "#------------#-----------#----------#---####----#----#--#-----------#",
    "#------------##----------#--------------####----#----#--#-----------#",
    "#------------#-----##----#####-##################----#--#-----------#",
    "#------------#----#------#--------#------#-----------#--#-----------#",
    "#------------#-----------#--------#------#----------##--##----------#",
    "#--#############-#####-###--------#------#---------#--##--#---------#",
    "#-------------#---------#-------------###----------#--##--#---------#",
    "#-------------#---------#---------------------------##--##----------#",
    "#######-------#####-#####-------------------------------------------#",
    "#------------------------------------------####--------##-----------#",
    "#---------------------------##--------------------------------------#",
    "#-------###---#####---------##----------------#---------------------#",
    "#----------###--------------------------------#------#####----------#",
    "#--------------------------#-------------------------#--------------#",
    "#--------------------------##------------##----------#--------------#",
    "#---------#-------------------------------#----------#--------------#",
    "#---------#-------------------------------#----------########-------#",
    "#---------#---------##################------------------------------#",
    "#------####---------#----------------#------------------------------#",
    "#-------------------#----------------#------------------------------#",
    "#-----###--------#---------------------#--------------#-------------#",
    "#-------------------#----------------#----------------#-------------#",
    "#-----####----------#----------------#----------------#----------#--#",
    "#--------#----------##################----------------#---------#---#",
    "#---------------------------------------------------------------#---#",
    "#---------------------------------------------------------------#---#",
    "#####################################################################"
  ],
  [
    "################################################",
    "#------######F#######--------------------------#",
    "#-----/-------------#--------------------------#",
    "#----#--####--------#--------------------------#",
    "#----#--#-##---####-###########----------------#",
    "#----#--#/-------|#-#---------#----------------#",
    "#----#--F-P----P--#-#-P-----P-#----------------#",
    "#----#--#---------#-#---------#----------------#",
    "#----#--#-----------F---------#----------------#",
    "#----#--#---------###---------#---------/|-----#",
    "#----#--#---------#-#---------#--------/--|----#",
    "#----#--#-P----P--#-#---------#-------/----|---#",
    "#----#--#|-------/--#---------#------#------#--#",
    "#----/--#-###-###---#---------######/--P--P--|-#",
    "#---/---#--/---|----#----------#---#----------|#",
    "#--/----#-/-----|---#-P-----P----#------------/#",
    "#-/--/#-|/--/#|--|###---------######|--P--P--/-#",
    "##--/-#|---/---|------------------#--F------#--#",
    "##--####--/-----|-----------------F---|----/---#",
    "##--------#------#######/-/####---######--/----#",
    "##-P----P-#----------#------#-------------#----#",
    "#F--------#----------#--------#-----------#----#",
    "##--------#----------###---#####--#########----#",
    "##-P----P-##############---#---#--#------------#",
    "##------------------------/#-/|#--#------------#",
    "###########---------------F#/-----#------------#",
    "#----------|--############F/-P--P-#------------#",
    "#-----------|---------------------#------------#",
    "#------------############|--------#------------#",
    "#-------------------------|-P--P-/-------------#",
    "#--------------------------|----/--------------#",
    "#---------------------------|--/---------------#",
    "#----------------------------|/----------------#",
    "################################################",
  ],
];
 
const mapIndex = 1;
const map = maps[mapIndex];
 
const GEOMETRY = {
  "#":  { type: "full",     solid: true  },
  "F":  { type: "full",     solid: false },
  "/":  { type: "diagonal", solid: true,  slope:  1 },
  "|":  { type: "diagonal", solid: true,  slope: -1 },
  "P":  { type: "pillar",   solid: true,  radius: 0.15 },
};
 
function getGeometry(char) {
  return GEOMETRY[char] ?? null;
}

const COLLISION_PROXY_PATH = path.join(__dirname, "assets", "map.gltf");
let cadModelTransform = null;
let collisionProxy = null;

function decodeDataUri(uri) {
  const match = String(uri || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  if (!match[2]) {
    return Buffer.from(decodeURIComponent(match[3] || ""));
  }
  return Buffer.from(match[3] || "", "base64");
}

function bufferToArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function loadBufferSource(uri, baseDir) {
  if (!uri) return null;
  if (String(uri).startsWith("data:")) {
    return decodeDataUri(uri);
  }
  const resolved = path.isAbsolute(uri) ? uri : path.join(baseDir, uri);
  if (!fs.existsSync(resolved)) return null;
  return fs.readFileSync(resolved);
}

function readAccessorData(gltf, buffers, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor || accessor.sparse) return null;
  const bufferView = gltf.bufferViews?.[accessor.bufferView];
  const buffer = buffers[bufferView?.buffer ?? 0];
  if (!buffer || !bufferView) return null;

  const componentType = accessor.componentType;
  const count = accessor.count || 0;
  const itemSize = accessor.type === "VEC3" ? 3 : accessor.type === "VEC2" ? 2 : 1;
  const base = bufferToArrayBuffer(buffer);
  const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);

  if (componentType === 5126) return new Float32Array(base, offset, count * itemSize);
  if (componentType === 5125) return new Uint32Array(base, offset, count * itemSize);
  if (componentType === 5123) return new Uint16Array(base, offset, count * itemSize);
  return null;
}

function pointInTriangle(point, a, b, c) {
  const v0x = c.x - a.x;
  const v0y = c.y - a.y;
  const v1x = b.x - a.x;
  const v1y = b.y - a.y;
  const v2x = point.x - a.x;
  const v2y = point.y - a.y;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-12) return false;

  const invDenom = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
  return u >= -1e-5 && v >= -1e-5 && u + v <= 1 + 1e-5;
}

function normalizeCadTransform(transform) {
  const rotation = transform?.rotation || {};
  const offset = transform?.offset || {};
  return {
    rotationX: Number.isFinite(transform?.rotationX) ? transform.rotationX : Number(rotation.x ?? DEFAULT_CAD_MODEL_TRANSFORM.rotationX),
    rotationY: Number.isFinite(transform?.rotationY) ? transform.rotationY : Number(rotation.y ?? DEFAULT_CAD_MODEL_TRANSFORM.rotationY),
    rotationZ: Number.isFinite(transform?.rotationZ) ? transform.rotationZ : Number(rotation.z ?? DEFAULT_CAD_MODEL_TRANSFORM.rotationZ),
    scale: Number.isFinite(transform?.scale) ? transform.scale : DEFAULT_CAD_MODEL_TRANSFORM.scale,
    offsetX: Number.isFinite(transform?.offsetX) ? transform.offsetX : Number(offset.x ?? DEFAULT_CAD_MODEL_TRANSFORM.offsetX),
    offsetY: Number.isFinite(transform?.offsetY) ? transform.offsetY : Number(offset.y ?? DEFAULT_CAD_MODEL_TRANSFORM.offsetY),
    offsetZ: Number.isFinite(transform?.offsetZ) ? transform.offsetZ : Number(offset.z ?? DEFAULT_CAD_MODEL_TRANSFORM.offsetZ),
  };
}

function applyCadTransform(point, transform) {
  const scale = transform.scale;
  let x = point.x * scale;
  let y = point.y * scale;
  let z = point.z * scale;

  const cosX = Math.cos(transform.rotationX);
  const sinX = Math.sin(transform.rotationX);
  let nextY = y * cosX - z * sinX;
  let nextZ = y * sinX + z * cosX;
  y = nextY;
  z = nextZ;

  const cosY = Math.cos(transform.rotationY);
  const sinY = Math.sin(transform.rotationY);
  let nextX = x * cosY + z * sinY;
  nextZ = -x * sinY + z * cosY;
  x = nextX;
  z = nextZ;

  const cosZ = Math.cos(transform.rotationZ);
  const sinZ = Math.sin(transform.rotationZ);
  nextX = x * cosZ - y * sinZ;
  nextY = x * sinZ + y * cosZ;

  return {
    x: nextX + transform.offsetX,
    y: nextY + transform.offsetY,
    z: z + transform.offsetZ,
  };
}

function loadCadTransform() {
  try {
    if (!fs.existsSync(CAD_TRANSFORM_PATH)) return { ...DEFAULT_CAD_MODEL_TRANSFORM };
    const json = JSON.parse(fs.readFileSync(CAD_TRANSFORM_PATH, "utf8"));
    return normalizeCadTransform(json);
  } catch {
    return { ...DEFAULT_CAD_MODEL_TRANSFORM };
  }
}

function buildCollisionProxy(gltf, buffers) {
  const triangles = [];
  const primitiveData = [];
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  const transform = cadModelTransform || (cadModelTransform = loadCadTransform());

  for (const mesh of gltf.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const positionData = readAccessorData(gltf, buffers, primitive.attributes?.POSITION);
      const indexData = readAccessorData(gltf, buffers, primitive.indices);
      if (!positionData || !indexData) continue;

      const vertices = [];
      for (let i = 0; i < positionData.length / 3; i++) {
        const vertex = {
          x: positionData[i * 3],
          y: positionData[i * 3 + 1],
          z: positionData[i * 3 + 2],
        };
        vertices.push(vertex);
        minX = Math.min(minX, vertex.x);
        minZ = Math.min(minZ, vertex.z);
        maxX = Math.max(maxX, vertex.x);
        maxZ = Math.max(maxZ, vertex.z);
      }

      primitiveData.push({ vertices, indexArray: Array.from(indexData) });
    }
  }

  const centerX = Number.isFinite(minX) && Number.isFinite(maxX) ? (minX + maxX) * 0.5 : 0;
  const centerZ = Number.isFinite(minZ) && Number.isFinite(maxZ) ? (minZ + maxZ) * 0.5 : 0;
  const centerPoint = applyCadTransform({ x: centerX, y: 0, z: centerZ }, transform);
  const project = (point) => {
    const transformed = applyCadTransform(point, transform);
    return {
      x: transformed.x - centerPoint.x,
      y: transformed.z - centerPoint.z,
    };
  };

  for (const primitive of primitiveData) {
    const { vertices, indexArray } = primitive;

    for (let i = 0; i < indexArray.length; i += 3) {
      const a = vertices[indexArray[i]];
      const b = vertices[indexArray[i + 1]];
      const c = vertices[indexArray[i + 2]];
      if (!a || !b || !c) continue;

      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const abz = b.z - a.z;
      const acx = c.x - a.x;
      const acy = c.y - a.y;
      const acz = c.z - a.z;
      const normalZ = abx * acy - aby * acx;
      const normalLength = Math.hypot(
        aby * acz - abz * acy,
        abz * acx - abx * acz,
        normalZ
      ) || 1;

      if (Math.abs(normalZ / normalLength) > 0.45) continue;

      const tri = [project(a), project(b), project(c)];

      const area = Math.abs(
        (tri[1].x - tri[0].x) * (tri[2].y - tri[0].y) -
        (tri[1].y - tri[0].y) * (tri[2].x - tri[0].x)
      );
      if (area < 1e-6) continue;

      triangles.push(tri);
    }
  }

  return triangles;
}

function loadCollisionProxy() {
  try {
    if (!fs.existsSync(COLLISION_PROXY_PATH)) return null;
    const gltf = JSON.parse(fs.readFileSync(COLLISION_PROXY_PATH, "utf8"));
    const baseDir = path.dirname(COLLISION_PROXY_PATH);
    const buffers = (gltf.buffers || []).map((buffer) => loadBufferSource(buffer.uri, baseDir));
    return buildCollisionProxy(gltf, buffers);
  } catch {
    return null;
  }
}

collisionProxy = loadCollisionProxy();
 
function isSolidAt(x, y) {
  if (collisionProxy && collisionProxy.length) {
    const point = { x, y };
    for (const tri of collisionProxy) {
      if (pointInTriangle(point, tri[0], tri[1], tri[2])) {
        return true;
      }
    }
  }

  return false;
}
 
// ── Authoritative ray-based shot simulation ───────────────────────────────────
// Returns the first collision along the shot path:
// - victimId when a player is hit
// - endpoint when world geometry (wall/floor/ceiling) is hit
function rayCastShotResult(shooterId, originX, originY, originZ, angle, pitch) {
  const cosPitch = Math.cos(pitch || 0);
  const dx   = Math.cos(angle) * RAY_STEP * cosPitch;
  const dy   = Math.sin(angle) * RAY_STEP * cosPitch;
  const dz   = -(pitch || 0) * PITCH_SCREEN_Y_SCALE * RAY_STEP * cosPitch;
  const maxSteps = Math.ceil(TRACER_MAX_RANGE / RAY_STEP);
 
  let x = originX;
  let y = originY;
  let z = originZ;
 
  for (let i = 0; i < maxSteps; i++) {
    x += dx;
    y += dy;
    z += dz;

    if (z <= 0) {
      return {
        victimId: null,
        endpoint: { x: x - dx * 0.5, y: y - dy * 0.5, z: 0, hitType: "floor" },
      };
    }

    if (z >= 1) {
      return {
        victimId: null,
        endpoint: { x: x - dx * 0.5, y: y - dy * 0.5, z: 1, hitType: "ceiling" },
      };
    }
 
    // Stop at solid wall
    if (isSolidAt(x, y)) {
      debugLog_server(`Ray hit wall at (${x.toFixed(2)}, ${y.toFixed(2)}) after ${i} steps`);
      return {
        victimId: null,
        endpoint: { x: x - dx * 0.5, y: y - dy * 0.5, z: z - dz * 0.5, hitType: "wall" },
      };
    }
 
    // Check each potential victim
    for (const victimId in players) {
      if (victimId === shooterId) continue;
      const victim = players[victimId];
      if (victim.health <= 0) continue;
      if (Date.now() < (victim.invincibleUntil || 0)) continue;
 
      const hitBoxXY = getPlayerHitBoxXY(victim);
      // Use the ray's current z (pitch-adjusted) vs victim's z (floor position).
      // Victim occupies z range [victim.z, victim.z + 1] (one world unit tall).
      // The ray hits if it passes through that vertical range.
      const victimZ    = victim.z || 0;
      const victimZTop = victimZ + 1.0;
      const zInRange   = z >= victimZ &&
                         z <= victimZTop;
 
      const xInRange = Math.abs(x - victim.x) <= hitBoxXY.halfWidth;
      const yInRange = Math.abs(y - victim.y) <= hitBoxXY.halfHeight;

      if (xInRange && yInRange && zInRange) {
        return { victimId, endpoint: null };
      }
    }
  }
 
  return { victimId: null, endpoint: null };
}
 
function debugLog_server(msg) {
  // console.log("[server ray]", msg);
}
 
// ── State ─────────────────────────────────────────────────────────────────────
const players     = {};
const playerStats = {};
 
let broadcastDirty = false;
 
// Broadcast loop — configurable (default 30 Hz)
setInterval(() => {
  if (broadcastDirty) {
    broadcastDirty = false;
    _doBroadcastPlayers();
  }
}, 1000 / BROADCAST_HZ);
 
// ── Helpers ───────────────────────────────────────────────────────────────────
function isFiniteNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}
 
function safeNum(v, fallback, min = -Infinity, max = Infinity) {
  return isFiniteNum(v) ? Math.min(max, Math.max(min, v)) : fallback;
}
 
function buildLeaderboard() {
  return Object.entries(playerStats)
    .filter(([id]) => players[id])
    .map(([id, stats]) => ({
      id,
      username: players[id]?.username || "Anonymous",
      kills:    stats.kills,
      deaths:   stats.deaths,
    }))
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
}
 
function _doBroadcastPlayers() {
  const cleanedPlayers = {};
  for (const id in players) {
    const p = players[id];
    cleanedPlayers[id] = {
      x:           p.x,
      y:           p.y,
      angle:       p.angle,
      cameraYaw:   p.cameraYaw ?? p.angle,
      z:           p.z,
      username:    p.username,
      projectiles: p.projectiles || [],
      health:      p.health,
      sneaking:    p.sneaking,
      isMoving:    Boolean(p.isMoving),
      isSprinting: Boolean(p.isSprinting),
      isDead:      p.health <= 0,
      isInvincible: Date.now() < (p.invincibleUntil || 0),
      kills:       playerStats[id]?.kills  || 0,
      deaths:      playerStats[id]?.deaths || 0,
    };
  }
 
  const leaderboard = buildLeaderboard();
  const msg = JSON.stringify({ type: "players", players: cleanedPlayers, leaderboard });
 
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) {
      try { c.send(msg); } catch {}
    }
  });
}
 
function markDirty() { broadcastDirty = true; }
 
function broadcastPlayersNow() {
  broadcastDirty = false;
  _doBroadcastPlayers();
}
 
function broadcastAll(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) {
      try { c.send(msg); } catch {}
    }
  });
}
 
function broadcastChat(name, message) { broadcastAll({ type: "chat", name, message }); }
function broadcastChatImage(name, imageData) { broadcastAll({ type: "chatImage", name, imageData }); }

function buildPlayerMetaMap() {
  const meta = {};
  for (const id in players) {
    const p = players[id];
    meta[id] = {
      username: p.username,
      sprite: p.sprite,
      spriteAspect: p.spriteAspect,
    };
  }
  return meta;
}

function broadcastPlayerMeta(id) {
  const p = players[id];
  if (!p) return;
  broadcastAll({
    type: "playerMeta",
    id,
    meta: {
      username: p.username,
      sprite: p.sprite,
      spriteAspect: p.spriteAspect,
    },
  });
}
 
// Keepalive
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
 
// ── Connection ────────────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2);
  ws.id    = id;
  ws.isAlive = true;
 
  players[id] = {
    x:              SPAWN.x,
    y:              SPAWN.y,
    angle:          SPAWN.angle,
    cameraYaw:      SPAWN.angle,
    z:              0,
    username:       "Anonymous",
    projectiles:    [],
    health:         MAX_HEALTH,
    sprite:         "/images/sprite1.png",
    spriteAspect:   0.5,
    invincibleUntil: Date.now() + SPAWN_INVINCIBILITY_MS,
    inMenu:         false,
    sneaking:       false,
    isMoving:       false,
    isSprinting:    false,
  };
 
  if (!playerStats[id]) {
    playerStats[id] = { kills: 0, deaths: 0 };
  }
 
  ws.send(JSON.stringify({ type: "init", id }));
  ws.send(JSON.stringify({ type: "playerMetaSnapshot", players: buildPlayerMetaMap() }));
  broadcastPlayerMeta(id);
 
  ws.on("pong", () => { ws.isAlive = true; });
 
  ws.on("message", (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    // ── App-level ping/pong (for browser RTT measurement) ─────────────────
    if (data.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", clientTs: data.clientTs, serverTs: Date.now() }));
      return;
    }
 
    // ── Chat ────────────────────────────────────────────────────────────────
    if (data.type === "chat") {
      const message = String(data.message || "").trim().slice(0, 300);
      if (message) broadcastChat(players[id].username, message);
      return;
    }
 
    if (data.type === "chatImage") {
      const imageData = String(data.imageData || "");
      if (imageData.startsWith("data:image/") && imageData.length < MAX_CHAT_IMAGE_DATA_URL_LENGTH) {
        broadcastChatImage(players[id].username, imageData);
      }
      return;
    }
 
    // ── Meta ────────────────────────────────────────────────────────────────
    if (data.type === "setName") {
      players[id].username = String(data.name || "Anonymous").trim().slice(0, 32) || "Anonymous";
      broadcastPlayerMeta(id);
      markDirty();
      return;
    }
 
    if (data.type === "setSprite") {
      const sprite = String(data.sprite || "");
      if (sprite.startsWith("data:image/")) {
        players[id].sprite = sprite.slice(0, MAX_INLINE_SPRITE_DATA_URL_LENGTH);
      } else {
        players[id].sprite = sprite.slice(0, MAX_REMOTE_SPRITE_URL_LENGTH);
      }
      players[id].spriteAspect = safeNum(data.spriteAspect, players[id].spriteAspect, 0.05, 8);
      broadcastPlayerMeta(id);
      markDirty();
      return;
    }
 
    if (data.type === "menuOpen") {
      players[id].inMenu = true;
      players[id].menuOpenedAt = Date.now();
      return;
    }
 
    if (data.type === "menuClosed") {
      if (players[id].menuOpenedAt) {
        const elapsed = Date.now() - players[id].menuOpenedAt;
        if (players[id].invincibleUntil > 0) players[id].invincibleUntil += elapsed;
        players[id].menuOpenedAt = 0;
      }
      players[id].inMenu = false;
      broadcastPlayersNow();
      return;
    }
 
    if (data.type === "initialSpawn") {
      players[id].invincibleUntil = Date.now() + SPAWN_INVINCIBILITY_MS;
      broadcastPlayersNow();
      return;
    }
 
    if (data.type === "respawn") {
      players[id] = {
        ...players[id],
        health:          MAX_HEALTH,
        invincibleUntil: Date.now() + SPAWN_INVINCIBILITY_MS,
        inMenu:          false,
        projectiles:     [],
        x:               SPAWN.x,
        y:               SPAWN.y,
        angle:           SPAWN.angle,
        cameraYaw:       SPAWN.angle,
        z:               0,
        isMoving:        false,
        isSprinting:     false,
      };
      broadcastPlayersNow();
      return;
    }
 
    // ── Raycast shot ────────────────────────────────────────────────────────
    if (data.type === "shoot") {
      if (players[id].inMenu) return;
      if (players[id].health <= 0) return;
 
      const originX = safeNum(data.x,     players[id].x,   0, 200);
      const originY = safeNum(data.y,     players[id].y,   0, 200);
      const originZ = safeNum(data.z,     players[id].z,   0, 10);
      const sentShotOriginZ = safeNum(data.shotOriginZ, originZ + PROJECTILE_START_Z, 0, 10);
      const angle   = safeNum(data.angle, players[id].cameraYaw ?? players[id].angle);
      const pitch   = safeNum(data.pitch, 0, -Math.PI/2, Math.PI/2);
      const expectedShotOriginZ = players[id].z + PROJECTILE_START_Z;
      const shotOriginZ = Math.abs(sentShotOriginZ - expectedShotOriginZ) <= 1
        ? sentShotOriginZ
        : expectedShotOriginZ;
 
      // Verify the origin is near the server's known position (anti-cheat)
      const posDrift = Math.hypot(originX - players[id].x, originY - players[id].y);
      if (posDrift > 2.0) return;
 
      // Pass pitch so the server ray tracks z correctly (no false hits above/below)
      const shotResult = rayCastShotResult(id, originX, originY, shotOriginZ, angle, pitch);
      const victimId = shotResult.victimId;
 
      if (victimId) {
        const victim    = players[victimId];
        const prevHealth = victim.health;
        victim.health   = Math.max(0, Number((victim.health - HIT_DAMAGE).toFixed(3)));
 
        if (prevHealth > 0 && victim.health <= 0) {
          if (!playerStats[id])       playerStats[id]       = { kills: 0, deaths: 0 };
          if (!playerStats[victimId]) playerStats[victimId] = { kills: 0, deaths: 0 };
          playerStats[id].kills++;
          playerStats[victimId].deaths++;
        }
 
        markDirty();
      }

      return;
    }
 
    // ── Default: movement update ────────────────────────────────────────────
    const prev = players[id];
 
    players[id] = {
      ...prev,
      x:       safeNum(data.x,     prev.x,     0, 200),
      y:       safeNum(data.y,     prev.y,     0, 200),
      angle:   safeNum(data.angle, prev.angle),
    cameraYaw: safeNum(data.cameraYaw, prev.cameraYaw ?? prev.angle),
      z:       safeNum(data.z,     prev.z,     0, 10),
      sneaking: Boolean(data.sneaking),
      isMoving: Boolean(data.isMoving),
      isSprinting: Boolean(data.isSprinting),
      projectiles: Array.isArray(data.projectiles)
        ? data.projectiles
            .slice(0, MAX_PROJECTILES_PER_PLAYER)
            .filter(
              (p) =>
                p &&
                typeof p === "object" &&
                typeof p.id === "number" &&
                isFiniteNum(p.x) &&
                isFiniteNum(p.y) &&
                isFiniteNum(p.vx) &&
                isFiniteNum(p.vy)
            )
        : prev.projectiles,
    };
 
    markDirty();
  });
 
  ws.on("close", () => {
    delete players[id];
    broadcastPlayersNow();
  });
});
 
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (broadcast ${BROADCAST_HZ} Hz)`);
});