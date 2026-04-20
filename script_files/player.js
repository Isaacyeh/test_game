import {
  PLAYER_RADIUS,
  MOVE_SPEED,
  JUMP_VELOCITY,
  GRAVITY,
  MAX_JUMP,
  PROJECTILE_SPEED,
  PROJECTILE_LIFETIME,
  PROJECTILE_START_Z,
  MAX_HEALTH,
  HIT_DAMAGE,
  PROJECTILE_HIT_RADIUS,
  SPAWN_INVINCIBILITY_DURATION,
  TRACER_MAX_RANGE,
  PITCH_SENSITIVITY,
  MAX_PITCH,
} from "./constant.js";
import { isWall, map, getGeometry } from "./map.js";
import { debugLog } from "./debug.js";
import { keybinds, isPressed, initKeyMouseRef } from "./keybindControls.js";
 
const SPAWN = { x: 17, y: 7, angle: 0, sneaking: false };
// Stamina constants
const MAX_STAMINA = 1;
const STAMINA_DRAIN = 0.005;
const STAMINA_REGEN = 0.003;
const STAMINA_COOLDOWN_FRAMES = 180;
const SPRINT_SPEED_MULT = 1.6;
 
const state = {
  player: { ...SPAWN },
  z: 0,
  zVel: 0,
  onGround: true,
  pitch: 0,              // vertical look angle in radians
  isChatting: false,
  isMenuOpen: false,
  inMenu: false,
  others: {},
  myId: null,
  projectiles: [],   // visual tracers only
  bulletHoles: [],   // decals left on walls
  health: MAX_HEALTH,
  isDead: false,
  deathTimer: 0,
  hasShot: true,
  cooldown: 0,
  canRespawn: false,
  isRespawning: false,
  invincibilityTimer: 0,
 
  stamina: MAX_STAMINA,
  staminaCooldown: 0,
  isSprinting: false,
 
  sprite: "https://www.clker.com/cliparts/a/4/1/d/1301963432622081819stick_figure%20(1).png",
  username: "",
};
 
let keysRef = null;
let wsRef = null;
let mouseRef = null;
let nextProjectileId = 1;
let COOLDOWN = 10;
 
export function initPlayer(keys, ws, mouse) {
  keysRef = keys;
  wsRef = ws;
  mouseRef = mouse;
  initKeyMouseRef(keysRef, mouseRef);
}
 
export function promptUsername() {
  const name = (prompt("Enter your username:") || "Anonymous").trim() || "Anonymous";
  state.username = name;
  return name;
}
 
export function setIsChatting(value) {
  state.isChatting = value;
}
 
export function setMenuOpen(value) {
  const isOpen = Boolean(value);
  state.isMenuOpen = isOpen;
  state.inMenu = isOpen;
 
  if (isOpen) {
    if (wsRef && wsRef.readyState === WebSocket.OPEN) {
      wsRef.send(JSON.stringify({ type: "menuOpen" }));
    }
  } else {
    if (wsRef && wsRef.readyState === WebSocket.OPEN) {
      wsRef.send(JSON.stringify({ type: "menuClosed" }));
    }
  }
}
 
export function setMyId(id) {
  state.myId = id;
  debugLog("networkSend", `My ID set: ${id}`);
}
 
export function setOthers(nextOthers) {
  const filtered = { ...nextOthers };
  if (state.myId && filtered[state.myId] !== undefined) {
    const serverHealth = filtered[state.myId].health;
    if (!state.inMenu) {
      if (!state.isDead && !state.isRespawning && serverHealth <= 0) {
        state.health = 0;
        state.isDead = true;
        state.deathTimer = 0;
        state.canRespawn = false;
        state.projectiles = [];
      }
      if (!state.isDead) {
        state.health = serverHealth;
      }
    }
    delete filtered[state.myId];
  }
  state.others = filtered;
}
 
export function setSprite(url) {
  state.sprite = url;
  if (wsRef && wsRef.readyState === WebSocket.OPEN) {
    wsRef.send(JSON.stringify({ type: "setSprite", sprite: url }));
  }
}
 
export function getState() {
  return state;
}
 
export function respawn() {
  if (!state.isDead || !state.canRespawn) return;
 
  state.isDead = false;
  state.canRespawn = false;
  state.deathTimer = 0;
  state.isRespawning = true;
  state.invincibilityTimer = SPAWN_INVINCIBILITY_DURATION;
 
  state.player.x = SPAWN.x;
  state.player.y = SPAWN.y;
  state.player.angle = SPAWN.angle;
  state.player.sneaking = SPAWN.sneaking;
 
  state.z = 0;
  state.zVel = 0;
  state.onGround = true;
 
  state.health = MAX_HEALTH;
  state.cooldown = 0;
  state.projectiles = [];
  state.bulletHoles = [];
  state.pitch = 0;
 
  state.stamina = MAX_STAMINA;
  state.staminaCooldown = 0;
  state.isSprinting = false;
 
  if (wsRef && wsRef.readyState === WebSocket.OPEN) {
    wsRef.send(JSON.stringify({ type: "respawn" }));
  }
 
  setTimeout(() => {
    state.isRespawning = false;
  }, 2000);
}
 
// ── Raycast shot ──────────────────────────────────────────────────────────────
// Steps along the ray in small increments. Returns the endpoint where the ray
// hits a wall or reaches max range. Player hit detection is server-authoritative;
// this is only used to determine the visual tracer endpoint and bullet hole data.
// pitch: vertical angle in radians (positive = up)
function raycastShot(originX, originY, originZ, angle, pitch) {
  const STEP = 0.05; // world units per step — small enough to never skip a wall
  const MAX_STEPS = Math.ceil(TRACER_MAX_RANGE / STEP);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const dx = Math.cos(angle) * STEP * cosPitch;
  const dy = Math.sin(angle) * STEP * cosPitch;
  const dz = STEP * sinPitch;
 
  let x = originX;
  let y = originY;
  let worldZ = originZ;
 
  for (let i = 0; i < MAX_STEPS; i++) {
    x += dx;
    y += dy;
    worldZ += dz;
 
    // Stop at solid wall
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    const char = map[tileY]?.[tileX];
    if (char) {
      const geo = getGeometry(char);
      if (geo && geo.solid) {
        // Step back a tiny bit so the tracer stops just before the wall face
        return { x: x - dx * 0.5, y: y - dy * 0.5, worldZ: worldZ - dz * 0.5, hitWall: true };
      }
    }
  }
 
  return { x, y, worldZ, hitWall: false };
}
 
function canMove(x, y) {
  return (
    !isWall(x + PLAYER_RADIUS, y + PLAYER_RADIUS) &&
    !isWall(x - PLAYER_RADIUS, y + PLAYER_RADIUS) &&
    !isWall(x + PLAYER_RADIUS, y - PLAYER_RADIUS) &&
    !isWall(x - PLAYER_RADIUS, y - PLAYER_RADIUS)
  );
}
 
export function update() {
  if (!keysRef || !wsRef || !mouseRef) return;
  if (state.inMenu) return;
 
  if (state.invincibilityTimer > 0 && !state.isMenuOpen) {
    state.invincibilityTimer--;
    debugLog("spawnInvincible", `Invincibility frames left: ${state.invincibilityTimer}`);
  }
 
  if (state.isDead) {
    state.deathTimer++;
    if (state.deathTimer >= 300) state.canRespawn = true;
    return;
  }
 
  const { player } = state;
  const blockControls = state.isChatting || state.isMenuOpen;
 
  // Turning
  if (!blockControls && isPressed(keybinds.turnLeft))  player.angle -= 0.04;
  if (!blockControls && isPressed(keybinds.turnRight)) player.angle += 0.04;
 
  let moveX = 0;
  let moveY = 0;
 
  // Sneak + Sprint
  state.player.sneaking = !blockControls && isPressed(keybinds.sneak);
 
  const isTryingToSprint =
    !blockControls &&
    isPressed(keybinds.sprint) &&
    !state.player.sneaking;
 
  if (isTryingToSprint && state.staminaCooldown === 0 && state.stamina > 0) {
    state.isSprinting = true;
    state.stamina = Math.max(0, state.stamina - STAMINA_DRAIN);
    if (state.stamina === 0) {
      state.staminaCooldown = STAMINA_COOLDOWN_FRAMES;
      state.isSprinting = false;
    }
  } else {
    state.isSprinting = false;
    if (state.staminaCooldown > 0) {
      state.staminaCooldown--;
    } else {
      state.stamina = Math.min(MAX_STAMINA, state.stamina + STAMINA_REGEN);
    }
  }
 
  const sneakSpeed  = state.player.sneaking ? 0.4 : 1;
  const sprintSpeed = state.isSprinting ? SPRINT_SPEED_MULT : 1;
  const effectiveSpeed = sneakSpeed * sprintSpeed;
 
  if (!blockControls && isPressed(keybinds.moveForward)) {
    moveX += Math.cos(player.angle) * MOVE_SPEED * effectiveSpeed;
    moveY += Math.sin(player.angle) * MOVE_SPEED * effectiveSpeed;
  }
  if (!blockControls && isPressed(keybinds.moveBackward)) {
    moveX -= Math.cos(player.angle) * MOVE_SPEED * effectiveSpeed;
    moveY -= Math.sin(player.angle) * MOVE_SPEED * effectiveSpeed;
  }
  if (!blockControls && isPressed(keybinds.moveLeft)) {
    moveX += Math.cos(player.angle - Math.PI / 2) * MOVE_SPEED * effectiveSpeed;
    moveY += Math.sin(player.angle - Math.PI / 2) * MOVE_SPEED * effectiveSpeed;
  }
  if (!blockControls && isPressed(keybinds.moveRight)) {
    moveX += Math.cos(player.angle + Math.PI / 2) * MOVE_SPEED * effectiveSpeed;
    moveY += Math.sin(player.angle + Math.PI / 2) * MOVE_SPEED * effectiveSpeed;
  }
 
  const nx = player.x + moveX;
  const ny = player.y + moveY;
 
  if (canMove(nx, ny)) {
    player.x = nx;
    player.y = ny;
  } else {
    if (canMove(nx, player.y)) player.x = nx;
    if (canMove(player.x, ny)) player.y = ny;
  }
 
  // Jump
  if (!blockControls && isPressed(keybinds.jump) && state.onGround) {
    state.zVel = JUMP_VELOCITY;
    state.onGround = false;
  }
 
  state.zVel -= GRAVITY;
  state.z    += state.zVel;
 
  if (state.z <= 0) {
    state.z    = 0;
    state.zVel = 0;
    state.onGround = true;
  }
 
  // Mouse look (horizontal + vertical)
  const mouseMoveX = mouseRef.dx || 0;
  const mouseMoveY = mouseRef.dy || 0;
  if (!blockControls && mouseMoveX !== 0) {
    player.angle += mouseMoveX * 0.006;
  }
  if (!blockControls && mouseMoveY !== 0) {
    state.pitch -= mouseMoveY * PITCH_SENSITIVITY;
    state.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, state.pitch));
  }
  mouseRef.dx = 0;
  mouseRef.dy = 0;
 
  // ── Shooting — raycast on trigger ─────────────────────────────────────────
  const primaryHeld   = !blockControls && isPressed(keybinds.shoot);
  const secondaryHeld = !blockControls && isPressed(keybinds.secondaryShoot);
 
  if (state.cooldown > 0) state.cooldown--;
 
  if ((primaryHeld || secondaryHeld) && state.cooldown === 0) {
    const pid = nextProjectileId++;
    const originZ = state.z + PROJECTILE_START_Z;
 
    // Cast a ray from shooter's position along their aim angle + pitch
    const endpoint = raycastShot(player.x, player.y, originZ, player.angle, state.pitch);
 
    // Total horizontal distance from origin to endpoint
    const totalDist = Math.hypot(endpoint.x - player.x, endpoint.y - player.y);
    const cosPitch = Math.cos(state.pitch);
    const sinPitch = Math.sin(state.pitch);
 
    const travelFrames = Math.max(1, Math.round(totalDist / (PROJECTILE_SPEED * Math.max(cosPitch, 0.01))));
 
    state.projectiles.push({
      id:          pid,
      x:           player.x,            // current tracer position
      y:           player.y,
      z:           originZ,
      originX:     player.x,            // fire origin (for server ray)
      originY:     player.y,
      originZ:     originZ,
      angle:       player.angle,        // aim angle (for server ray)
      pitch:       state.pitch,
      endX:        endpoint.x,          // wall/range endpoint
      endY:        endpoint.y,
      endZ:        endpoint.worldZ,
      vx:          Math.cos(player.angle) * PROJECTILE_SPEED * cosPitch,
      vy:          Math.sin(player.angle) * PROJECTILE_SPEED * cosPitch,
      vz:          PROJECTILE_SPEED * sinPitch,
      ttl:         travelFrames,        // dies when it reaches endpoint
      totalFrames: travelFrames,
      hitWall:     endpoint.hitWall,
    });
 
    // If the shot hit a wall, create a bullet hole decal
    if (endpoint.hitWall) {
      const MAX_BULLET_HOLES = 50;
      state.bulletHoles.push({
        worldX:  endpoint.x,
        worldY:  endpoint.y,
        // worldZ is the world height of impact. Eye level = 0.5 + z, walls = [0,1].
        // Clamp to valid wall range.
        worldZ:  Math.max(0.05, Math.min(0.95, endpoint.worldZ)),
        angle:   player.angle,
        dist:    totalDist,
      });
      if (state.bulletHoles.length > MAX_BULLET_HOLES) {
        state.bulletHoles.shift();
      }
    }
 
    debugLog("projectileFire", `FIRED id=${pid} range=${totalDist.toFixed(2)} frames=${travelFrames} pitch=${state.pitch.toFixed(2)}`);
 
    state.cooldown = COOLDOWN;
 
    // Tell server about the ray (not the moving projectile)
    // Server does its own authoritative hit detection using the ray
    if (wsRef.readyState === WebSocket.OPEN) {
      wsRef.send(JSON.stringify({
        type:    "shoot",
        id:      pid,
        x:       player.x,
        y:       player.y,
        z:       originZ,
        angle:   player.angle,
        pitch:   state.pitch,
      }));
    }
  }
 
  // ── Advance visual tracers ────────────────────────────────────────────────
  state.projectiles = state.projectiles.filter((p) => {
    p.x   += p.vx;
    p.y   += p.vy;
    p.z   += (p.vz || 0);
    p.ttl--;
 
    // Kill tracer if it has reached (or passed) its endpoint
    const dFromOrigin = Math.hypot(p.x - p.originX, p.y - p.originY);
    const totalDist   = Math.hypot(p.endX - p.originX, p.endY - p.originY);
    if (dFromOrigin >= totalDist) return false;
 
    return p.ttl > 0;
  });
 
  // ── Network: send position + visual tracers ───────────────────────────────
  // We still send projectiles so other clients can see the tracers.
  // The server ignores these for hit detection (it uses "shoot" rays instead).
  if (wsRef.readyState === WebSocket.OPEN) {
    wsRef.send(JSON.stringify({
      x:          player.x,
      y:          player.y,
      angle:      player.angle,
      z:          state.z,
      pitch:      state.pitch,
      projectiles: state.projectiles.map((p) => ({
        id:  p.id,
        x:   p.x,
        y:   p.y,
        z:   p.z,
        vx:  p.vx,
        vy:  p.vy,
        vz:  p.vz || 0,
        ttl: p.ttl,
      })),
      health:    state.health,
      sneaking:  state.player.sneaking,
    }));
  }
}