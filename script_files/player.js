import {
  PLAYER_RADIUS,
  MOVE_SPEED,
  JUMP_VELOCITY,
  GRAVITY,
  MAX_JUMP,
  PROJECTILE_SPEED,
  PROJECTILE_LIFETIME,
  PROJECTILE_START_Z,
  PROJECTILE_RADIUS,
  TRACER_MAX_RANGE,
  MAX_HEALTH,
  HIT_DAMAGE,
  SPAWN_INVINCIBILITY_DURATION,
  PITCH_MAX,
  PITCH_SPEED,
  PITCH_MOUSE_SENS,
  PITCH_SCREEN_Y_SCALE,
  FIRE_RATE_FRAMES,
} from "./constant.js";
import { isWall } from "./map.js";
import { debugLog } from "./debug.js";
import { keybinds, isPressed, initKeyMouseRef } from "./keybindControls.js";
 
const SPAWN = { x: 17, y: 7, angle: 0, sneaking: false };
 
// Stamina constants
const MAX_STAMINA = 1;
const STAMINA_DRAIN = 0.005;
const STAMINA_REGEN = 0.003;
const STAMINA_COOLDOWN_FRAMES = 180;
const SPRINT_SPEED_MULT = 1.6;
const NETWORK_SEND_INTERVAL_MS = 33;
const CAMERA_TURN_SPEED = 0.035;
 
const state = {
  player: { ...SPAWN },
  isMoving: false,
  isShiftLock: false,
  cameraYaw: SPAWN.angle,
  moveFacingAngle: SPAWN.angle,
  z: 0,
  zVel: 0,
  onGround: true,
  isChatting: false,
  isMenuOpen: false,
  inMenu: false,
  others: {},
  myId: null,
  projectiles: [],   // visual tracers only
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
 
  pitch: 0,   // vertical camera angle (radians, + = look down, - = look up)
 
  username: "",
  networkRttMs: null,
  networkJitterMs: null,
  lastPongAt: 0,
};
 
let keysRef = null;
let wsRef = null;
let mouseRef = null;
let nextProjectileId = 1;
let lastNetworkSendAt = 0;
 
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

export function toggleMovementMode() {
  state.isShiftLock = false;
  return state.isShiftLock;
}
 
export function setMyId(id) {
  state.myId = id;
  debugLog("networkSend", `My ID set: ${id}`);
}
 
export function setOthers(nextOthers) {
  const prevOthers = state.others;
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

  for (const id in filtered) {
    const prev = prevOthers[id];
    if (!prev) continue;
    if (filtered[id].username == null) filtered[id].username = prev.username;
  }

  state.others = filtered;
}

export function updateRemoteMeta(id, meta) {
  if (!id || !meta) return;
  if (id === state.myId) return;
  const current = state.others[id] || {};
  state.others[id] = {
    ...current,
    username: meta.username ?? current.username,
  };
}
 
export function getState() {
  return state;
}

export function setNetworkLag(rttMs, jitterMs) {
  state.networkRttMs = Number.isFinite(rttMs) ? rttMs : null;
  state.networkJitterMs = Number.isFinite(jitterMs) ? jitterMs : null;
  state.lastPongAt = Date.now();
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
  state.isMoving = false;
  state.isShiftLock = false;
  state.cameraYaw = SPAWN.angle;
  state.moveFacingAngle = SPAWN.angle;
 
  state.z = 0;
  state.zVel = 0;
  state.onGround = true;
  state.pitch = 0;
 
  state.health = MAX_HEALTH;
  state.cooldown = 0;
  state.projectiles = [];
 
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
// Returns xy endpoint, world-z at impact, and surface type hit.
function raycastShot(originX, originY, originZ, angle, pitch) {
  const STEP = 0.05;
  const MAX_STEPS = Math.ceil(TRACER_MAX_RANGE / STEP);
  const cosPitch = Math.cos(pitch);
  const dx = Math.cos(angle) * STEP * cosPitch;
  const dy = Math.sin(angle) * STEP * cosPitch;
  const dz = -pitch * PITCH_SCREEN_Y_SCALE * STEP * cosPitch;
 
  let x = originX, y = originY, z = originZ;
 
  for (let i = 0; i < MAX_STEPS; i++) {
    x += dx; y += dy; z += dz;
 
    if (z <= 0) return { x: x-dx*0.5, y: y-dy*0.5, z: 0,        hitWall: true, hitType: "floor"   };
    if (z >= 1) return { x: x-dx*0.5, y: y-dy*0.5, z: 1,        hitWall: true, hitType: "ceiling" };
 
    if (isWall(x, y)) {
      return { x: x-dx*0.5, y: y-dy*0.5, z: z-dz*0.5, hitWall: true, hitType: "wall" };
    }
  }
  return { x, y, z, hitWall: false, hitType: "none" };
}
 
function getCrosshairGamePosition() {
  const canvas = document.getElementById("game");
  if (!canvas) return null;
  return {
    x: canvas.width / 2,
    y: canvas.height / 2,
  };
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

  state.isShiftLock = false;

  if (state.staminaCooldown > 0) state.staminaCooldown--;

  if (!blockControls) {
    state.cameraYaw += mouseRef.dx * CAMERA_TURN_SPEED;
    state.pitch += mouseRef.dy * PITCH_MOUSE_SENS;

    if (isPressed(keybinds.turnLeft)) {
      state.cameraYaw -= CAMERA_TURN_SPEED;
    }
    if (isPressed(keybinds.turnRight)) {
      state.cameraYaw += CAMERA_TURN_SPEED;
    }
    if (keysRef.ArrowUp) {
      state.pitch -= PITCH_SPEED;
    }
    if (keysRef.ArrowDown) {
      state.pitch += PITCH_SPEED;
    }
  }

  state.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, state.pitch));

  const movingForward = !blockControls && isPressed(keybinds.moveForward);
  const movingBackward = !blockControls && isPressed(keybinds.moveBackward);
  const movingLeft = !blockControls && isPressed(keybinds.moveLeft);
  const movingRight = !blockControls && isPressed(keybinds.moveRight);
  const jumping = !blockControls && isPressed(keybinds.jump);
  const sneaking = !blockControls && isPressed(keybinds.sneak);

  const forwardAxis = (movingForward ? 1 : 0) - (movingBackward ? 1 : 0);
  const strafeAxis = (movingRight ? 1 : 0) - (movingLeft ? 1 : 0);

  let moveX = 0;
  let moveY = 0;

  if (forwardAxis || strafeAxis) {
    const yaw = state.cameraYaw;
    // Match Babylon camera yaw mapping: +yaw rotates toward negative map Y.
    const forwardX = Math.cos(yaw);
    const forwardY = -Math.sin(yaw);
    const rightX = -forwardY;
    const rightY = forwardX;

    moveX = forwardX * forwardAxis + rightX * strafeAxis;
    moveY = forwardY * forwardAxis + rightY * strafeAxis;

    const moveLen = Math.hypot(moveX, moveY) || 1;
    moveX /= moveLen;
    moveY /= moveLen;
  }

  const wantsToSprint =
    !sneaking &&
    !blockControls &&
    isPressed(keybinds.sprint) &&
    (forwardAxis !== 0 || strafeAxis !== 0) &&
    state.staminaCooldown <= 0 &&
    state.stamina > 0;

  if (wantsToSprint) {
    state.stamina = Math.max(0, state.stamina - STAMINA_DRAIN);
    state.isSprinting = true;
    if (state.stamina <= 0) {
      state.staminaCooldown = STAMINA_COOLDOWN_FRAMES;
      state.isSprinting = false;
    }
  } else {
    state.stamina = Math.min(MAX_STAMINA, state.stamina + STAMINA_REGEN);
    state.isSprinting = false;
  }

  let moveSpeed = MOVE_SPEED;
  if (state.isSprinting) moveSpeed *= SPRINT_SPEED_MULT;
  if (sneaking) moveSpeed *= 0.55;
  state.player.sneaking = sneaking;

  const nextX = player.x + moveX * moveSpeed;
  const nextY = player.y + moveY * moveSpeed;
  if (canMove(nextX, player.y)) player.x = nextX;
  if (canMove(player.x, nextY)) player.y = nextY;

  state.isMoving = Boolean(forwardAxis || strafeAxis);
  if (state.isMoving) {
    const movementYaw = Math.atan2(moveY, moveX);
    state.moveFacingAngle = movementYaw;
    player.angle = movementYaw;
  } else {
    state.moveFacingAngle = player.angle;
  }

  if (jumping && state.onGround) {
    state.zVel = JUMP_VELOCITY;
    state.onGround = false;
  }

  if (!state.onGround || state.z > 0 || state.zVel > 0) {
    state.z += state.zVel;
    state.zVel -= GRAVITY;
    if (state.z > MAX_JUMP && state.zVel > 0) state.zVel = 0;
    if (state.z <= 0) {
      state.z = 0;
      state.zVel = 0;
      state.onGround = true;
    }
  }

  mouseRef.dx = 0;
  mouseRef.dy = 0;
 
  // ── Shooting ──────────────────────────────────────────────────────────────
  const primaryHeld   = !blockControls && isPressed(keybinds.shoot);
  const secondaryHeld = !blockControls && isPressed(keybinds.secondaryShoot);
 
  if (state.cooldown > 0) state.cooldown--;
 
  if ((primaryHeld || secondaryHeld) && state.cooldown === 0) {
    const pid = nextProjectileId++;
    const aimYaw = state.cameraYaw;
 
    // Visual bullet origin: eye/torso height
    const bulletOriginZ = state.z + PROJECTILE_START_Z;
    const cosPitch = Math.cos(state.pitch);
    const startOffset = 0.2;
    const startX = player.x + Math.cos(aimYaw) * startOffset * cosPitch;
    const startY = player.y + Math.sin(aimYaw) * startOffset * cosPitch;
 
    const endpoint = raycastShot(
      player.x, player.y, bulletOriginZ,
      aimYaw, state.pitch
    );
 
    const totalDist    = Math.hypot(endpoint.x - startX, endpoint.y - startY);
    const travelFrames = Math.max(1, Math.round(totalDist / PROJECTILE_SPEED));
    const pitchSlope   = state.pitch * PITCH_SCREEN_Y_SCALE;
 
    state.projectiles.push({
      id:          pid,
      x:           startX,
      y:           startY,
      z:           bulletOriginZ,
      originX:     startX,
      originY:     startY,
      originZ:     bulletOriginZ,
      angle:       aimYaw,
      pitch:       state.pitch,
      isMoving:    state.isMoving,
      endX:        endpoint.x,
      endY:        endpoint.y,
      endZ:        endpoint.z,
      vx:          Math.cos(aimYaw) * PROJECTILE_SPEED * cosPitch,
      vy:          Math.sin(aimYaw) * PROJECTILE_SPEED * cosPitch,
      vz:          -pitchSlope * PROJECTILE_SPEED * cosPitch,
      ttl:         travelFrames,
      totalFrames: travelFrames,
      spawnFramesLeft: 1,
      hitWall:     endpoint.hitWall,
      hitType:     endpoint.hitType,
    });
 
    debugLog("projectileFire",
      `FIRED id=${pid} range=${totalDist.toFixed(2)} frames=${travelFrames} ` +
      `pitch=${state.pitch.toFixed(3)} type=${endpoint.hitType}`);

    const crosshair = getCrosshairGamePosition();
    const crosshairText = crosshair
      ? `crosshairGamePx=(${crosshair.x.toFixed(1)},${crosshair.y.toFixed(1)})`
      : "crosshair=unavailable";
    debugLog("shotPlacement",
      `SHOT id=${pid} ${crosshairText} surface=${endpoint.hitType}`);
 
    // FIRE_RATE_FRAMES from constant.js controls shots-per-second
    state.cooldown = FIRE_RATE_FRAMES;
 
    // Send floor-relative z to server so the Z hit check passes.
    // The server's rayCastHit now tracks z along the ray using pitch,
    // so it won't falsely hit players that are above/below the aim line.
    if (wsRef.readyState === WebSocket.OPEN) {
      wsRef.send(JSON.stringify({
        type:    "shoot",
        id:      pid,
        x:       player.x,
        y:       player.y,
        z:       state.z,       // floor-relative, NOT +PROJECTILE_START_Z
        shotOriginZ: bulletOriginZ,
        angle:   aimYaw,
        pitch:   state.pitch,
      }));
    }
  }
 
  // ── Advance visual tracers ────────────────────────────────────────────────
  state.projectiles = state.projectiles.filter((p) => {
    if (p.spawnFramesLeft > 0) {
      p.spawnFramesLeft--;
    } else {
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
    }
    p.ttl--;
    const dFromOrigin = Math.hypot(p.x - p.originX, p.y - p.originY);
    const totalDist   = Math.hypot(p.endX - p.originX, p.endY - p.originY);
    if (dFromOrigin >= totalDist) return false;
    return p.ttl > 0;
  });
 
  // ── Network: send position + visual tracers ───────────────────────────────
  const now = performance.now();
  if (wsRef.readyState === WebSocket.OPEN && now - lastNetworkSendAt >= NETWORK_SEND_INTERVAL_MS) {
    lastNetworkSendAt = now;
    wsRef.send(JSON.stringify({
      x:           player.x,
      y:           player.y,
      angle:       player.angle,
      cameraYaw:   state.cameraYaw,
      z:           state.z,
      pitch:       state.pitch,
      isMoving:    state.isMoving,
      projectiles: state.projectiles.map((p) => ({
        id:  p.id,
        x:   p.x,
        y:   p.y,
        z:   p.z,
        vx:  p.vx,
        vy:  p.vy,
        vz:  p.vz,
        ttl: p.ttl,
      })),
      health:    state.health,
      sneaking:  state.player.sneaking,
    }));
  }
}