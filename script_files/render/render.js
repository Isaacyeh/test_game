import { MAX_HEALTH } from "../constant.js";
import { getState, respawn } from "../player.js";
import { getCrosshairOptions } from "../crosshair.js";
import { debugToggles } from "../debug.js";
import { renderBabylonWorld } from "./babylonWorld.js";

let lastFrameTime = performance.now();
const frameTimeSamples = [];
const maxSamples = 60;
let currentFPS = 0;
let currentFrameTimeMs = 0;
let debugThrottleEnabled = false;

function updateFPS() {
  const now = performance.now();
  const deltaTime = now - lastFrameTime;
  lastFrameTime = now;
  frameTimeSamples.push(deltaTime);
  if (frameTimeSamples.length > maxSamples) {
    frameTimeSamples.shift();
  }
  const avgFrameTime = frameTimeSamples.reduce((a, b) => a + b, 0) / frameTimeSamples.length;
  currentFPS = Math.round(1000 / avgFrameTime);
  currentFrameTimeMs = avgFrameTime.toFixed(1);
}

function applyDebugThrottle() {
  if (!debugThrottleEnabled || !debugToggles.fpsLabel.enabled) return;
  const targetFrameTime = 50;
  const start = performance.now();
  while (performance.now() - start < targetFrameTime) {
    // Busy wait intentionally for FPS/debug validation.
  }
}

window.addEventListener("keydown", (e) => {
  if (e.key === "t" || e.key === "T") {
    if (!debugToggles.fpsLabel.enabled) {
      console.log("FPS counter must be enabled to use CPU throttle");
      return;
    }
    debugThrottleEnabled = !debugThrottleEnabled;
    console.log(`Debug throttle ${debugThrottleEnabled ? "ENABLED (20 FPS)" : "DISABLED"}`);
  }
});

function drawHealthBar(ctx, x, y, width, height, healthRatio) {
  const ratio = Math.max(0, Math.min(1, healthRatio));
  const pad = 2;
  ctx.fillStyle = "#666";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#111";
  ctx.fillRect(x + pad, y + pad, width - pad * 2, height - pad * 2);
  ctx.fillStyle = "#d00";
  ctx.fillRect(x + pad, y + pad, (width - pad * 2) * ratio, height - pad * 2);
}

function drawStaminaBar(ctx, x, y, width, height, stamina, staminaCooldown) {
  const ratio = Math.max(0, Math.min(1, stamina));
  const pad = 2;
  ctx.fillStyle = "#555";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#111";
  ctx.fillRect(x + pad, y + pad, width - pad * 2, height - pad * 2);
  if (staminaCooldown > 0) {
    ctx.fillStyle = Math.sin(Date.now() / 120) > 0 ? "#cc0000" : "#550000";
    ctx.fillRect(x + pad, y + pad, width - pad * 2, height - pad * 2);
  } else {
    ctx.fillStyle = "#e8e8a0";
    ctx.fillRect(x + pad, y + pad, (width - pad * 2) * ratio, height - pad * 2);
  }
}

function drawCrosshair(canvas, ctx) {
  const { opacity, image } = getCrosshairOptions();
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.save();
  ctx.globalAlpha = opacity;
  if (image && image.complete && !image.__error) {
    const size = 34;
    ctx.drawImage(image, cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = "#000000";
    ctx.font = "bold 34px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", cx, cy);
  }
  ctx.restore();
}

let leaderboardData = [];

export function updateLeaderboard(data) {
  if (Array.isArray(data)) leaderboardData = data;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawLeaderboard(canvas, ctx) {
  const rows = leaderboardData;
  if (!rows || !rows.length) return;
  const padX = 28;
  const padY = 20;
  const rowH = 36;
  const headerH = 52;
  const colW = [220, 90, 90];
  const totalW = colW.reduce((a, b) => a + b, 0) + padX * 2;
  const totalH = headerH + rows.length * rowH + padY * 2;
  const startX = Math.floor((canvas.width - totalW) / 2);
  const startY = Math.floor((canvas.height - totalH) / 2);
  ctx.save();
  ctx.fillStyle = "rgba(8,8,12,0.88)";
  roundRect(ctx, startX, startY, totalW, totalH, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(180,180,210,0.35)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, startX, startY, totalW, totalH, 10);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 22px 'Courier New',monospace";
  ctx.fillStyle = "#c8c8d8";
  ctx.fillText("LEADERBOARD", startX + totalW / 2, startY + padY + 12);
  ctx.strokeStyle = "rgba(180,180,210,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(startX + padX, startY + headerH);
  ctx.lineTo(startX + totalW - padX, startY + headerH);
  ctx.stroke();
  ctx.font = "bold 12px 'Courier New',monospace";
  ctx.fillStyle = "#778899";
  ctx.textAlign = "left";
  ctx.fillText("PLAYER", startX + padX, startY + headerH + 10);
  ctx.textAlign = "center";
  ctx.fillText("KILLS", startX + padX + colW[0] + colW[1] / 2, startY + headerH + 10);
  ctx.fillText("DEATHS", startX + padX + colW[0] + colW[1] + colW[2] / 2, startY + headerH + 10);
  rows.forEach((entry, i) => {
    const ry = startY + headerH + 26 + i * rowH;
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(startX + 4, ry - rowH * 0.4, totalW - 8, rowH * 0.88);
    }
    const rankColors = ["#ffd700", "#c0c0c0", "#cd7f32"];
    ctx.font = "bold 13px 'Courier New',monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = rankColors[i] || "#556677";
    ctx.fillText(`#${i + 1}`, startX + padX + 14, ry);
    ctx.textAlign = "left";
    ctx.fillStyle = "#dde0e8";
    ctx.font = "14px 'Courier New',monospace";
    ctx.fillText((entry.username || "Anonymous").slice(0, 20), startX + padX + 36, ry);
    ctx.textAlign = "center";
    ctx.fillStyle = "#44cc88";
    ctx.font = "bold 14px 'Courier New',monospace";
    ctx.fillText(String(entry.kills || 0), startX + padX + colW[0] + colW[1] / 2, ry);
    ctx.fillStyle = "#cc5555";
    ctx.fillText(String(entry.deaths || 0), startX + padX + colW[0] + colW[1] + colW[2] / 2, ry);
  });
  ctx.font = "11px 'Courier New',monospace";
  ctx.fillStyle = "rgba(150,150,170,0.5)";
  ctx.textAlign = "center";
  ctx.fillText("Release TAB to close", startX + totalW / 2, startY + totalH - 10);
  ctx.restore();
}

let tabHeld = false;
window.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    tabHeld = true;
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    tabHeld = false;
  }
});

let respawnListenerAdded = false;
function setupRespawnButton(canvas) {
  if (respawnListenerAdded) return;
  respawnListenerAdded = true;
  canvas.addEventListener("click", (e) => {
    const state = getState();
    if (!state.isDead || !state.canRespawn) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const bx = canvas.width / 2 - 100;
    const by = canvas.height / 2 + 85;
    if (mx >= bx && mx <= bx + 200 && my >= by && my <= by + 50) respawn();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Tab") return;
    const state = getState();
    if (state.isDead && state.canRespawn) respawn();
  });
}

export function render(canvas, ctx) {
  applyDebugThrottle();
  setupRespawnButton(canvas);
  const {
    player,
    z,
    pitch,
    others,
    myId,
    isMoving,
    isSprinting,
    isShiftLock,
    moveFacingAngle,
    cameraYaw,
    health,
    isDead,
    deathTimer,
    canRespawn,
    stamina,
    staminaCooldown,
    networkRttMs,
    networkJitterMs,
    lastPongAt,
  } = getState();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderBabylonWorld(canvas, {
    player,
    z,
    pitch,
    others,
    myId,
    isMoving,
    isSprinting,
    isShiftLock,
    moveFacingAngle,
    cameraYaw,
  });

  const hudX = 24;
  const hudW = Math.min(420, canvas.width * 0.55);
  const hpH = 30;
  const stH = 10;
  const gap = 6;
  const hpY = canvas.height - 50;
  drawHealthBar(ctx, hudX, hpY, hudW, hpH, health / MAX_HEALTH);
  drawStaminaBar(ctx, hudX, hpY - stH - gap, hudW, stH, stamina, staminaCooldown);

  if (isShiftLock) {
    drawCrosshair(canvas, ctx);
  }

  updateFPS();
  let yOffset = 10;
  if (debugToggles.fpsLabel.enabled) {
    ctx.save();
    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(200,200,200,0.6)";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${currentFPS} FPS (${currentFrameTimeMs}ms)`, canvas.width - 10, yOffset);
    ctx.restore();
    yOffset += 14;
  }

  if (debugThrottleEnabled && debugToggles.fpsLabel.enabled) {
    ctx.save();
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#ff6666";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("[DEBUG THROTTLE ON - Press T to disable]", canvas.width - 10, yOffset);
    ctx.restore();
    yOffset += 14;
  }

  const pitchShowing = debugToggles.pitchLabel.enabled && Math.abs(pitch) > 0.04;
  if (pitchShowing) {
    const deg = Math.round(pitch * (180 / Math.PI));
    ctx.save();
    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(200,200,200,0.6)";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${deg > 0 ? "↓" : "↑"}${Math.abs(deg)}°`, canvas.width - 10, yOffset);
    ctx.restore();
    yOffset += 14;
  }

  if (debugToggles.networkLagLabel.enabled) {
    let label = "NET --";
    let color = "rgba(200,200,200,0.6)";
    const stale = !lastPongAt || (Date.now() - lastPongAt) > 5000;
    if (stale) {
      label = "NET timeout";
      color = "#ff6666";
    } else if (Number.isFinite(networkRttMs)) {
      const rtt = Math.round(networkRttMs);
      const jitter = Number.isFinite(networkJitterMs) ? Math.round(networkJitterMs) : 0;
      label = `NET ${rtt}ms (j${jitter})`;
      const goodFeel = rtt <= 60 && jitter <= 10;
      const playableButLaggy = rtt <= 180 && jitter <= 40;
      if (goodFeel) color = "#7bd88f";
      else if (playableButLaggy) color = "#f3d47a";
      else color = "#ff6666";
    }
    ctx.save();
    ctx.font = "12px monospace";
    ctx.fillStyle = color;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(label, canvas.width - 10, yOffset);
    ctx.restore();
  }

  if (tabHeld) drawLeaderboard(canvas, ctx);

  if (isDead) {
    ctx.fillStyle = "rgba(180,0,0,0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 96px Arial";
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillText("YOU DIED", canvas.width / 2 + 4, canvas.height / 2 - 36);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("YOU DIED", canvas.width / 2, canvas.height / 2 - 40);
    if (!canRespawn) {
      const s = Math.ceil((300 - deathTimer) / 60);
      ctx.font = "bold 28px Arial";
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillText(`Respawn available in ${s}...`, canvas.width / 2 + 2, canvas.height / 2 + 42);
      ctx.fillStyle = "#ffcccc";
      ctx.fillText(`Respawn available in ${s}...`, canvas.width / 2, canvas.height / 2 + 40);
    } else {
      const bx = canvas.width / 2 - 100;
      const by = canvas.height / 2 + 85;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(bx + 3, by + 3, 200, 50);
      ctx.fillStyle = "#cc0000";
      ctx.fillRect(bx, by, 200, 50);
      ctx.strokeStyle = "#ff6666";
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, 200, 50);
      ctx.font = "bold 22px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("RESPAWN", canvas.width / 2, by + 25);
      ctx.font = "14px Arial";
      ctx.fillStyle = "#ffcccc";
      ctx.fillText("or press any key", canvas.width / 2, by + 65);
    }
  }
}