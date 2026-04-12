import { FOV, JUMP_SCALE, MAX_HEALTH } from "../constant.js";
import { castRay } from "./castRay.js";
import { drawMinimap } from "./minimap.js";
import { getState, respawn } from "../player.js";
import { getCrosshairOptions } from "../crosshair.js";
 
// Cache for player sprite images (static images and first-frame GIFs)
// GIFs animate automatically because ctx.drawImage is called every frame.
const playerImages = new Map(); // id -> { img, url }
 
function getPlayerImage(id, spriteUrl) {
  if (!spriteUrl) return null;
  const existing = playerImages.get(id);
  if (existing && existing.url === spriteUrl) return existing.img;
 
  const img = new Image();
  img.__loaded = false;
  img.__error = false;
  img.onload = () => { img.__loaded = true; };
  img.onerror = () => {
    img.__loaded = true;
    img.__error = true;
    console.warn(`Sprite failed to load for player ${id}:`, spriteUrl);
  };
  img.src = spriteUrl;
  playerImages.set(id, { img, url: spriteUrl });
  return img;
}
 
/**
 * Returns the border color for a player's hitbox based on their current state.
 * Priority: dead > invincible > sneaking > normal
 */
function hitboxColor(p) {
  if (p.isDead || p.health <= 0)  return "#888888"; // grey  — dead
  if (p.isInvincible)             return "#ffdd00"; // yellow — spawn protection
  if (p.sneaking)                 return "#00cc44"; // green  — sneaking
  return "#cc0000";                                  // red    — normal
}
 
function drawSphere(ctx, x, y, radius, color = "#4db8ff") {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
 
function drawHealthBar(ctx, x, y, width, height, healthRatio) {
  const ratio = Math.max(0, Math.min(1, healthRatio));
  ctx.fillStyle = "#666";
  ctx.fillRect(x, y, width, height);
  const pad = 2;
  const iw = Math.max(0, width - pad * 2);
  const ih = Math.max(0, height - pad * 2);
  ctx.fillStyle = "#111";
  ctx.fillRect(x + pad, y + pad, iw, ih);
  ctx.fillStyle = "#d00";
  ctx.fillRect(x + pad, y + pad, iw * ratio, ih);
}
 
function drawCrosshair(canvas, ctx) {
  const { opacity, image } = getCrosshairOptions();
  const cx = canvas.width / 2;
  const cy = canvas.height / 2 + canvas.height * 0.04;
 
  ctx.save();
  ctx.globalAlpha = opacity;
 
  if (image && image.complete && !image.__error) {
    const size = 34;
    // Draw every frame so GIF crosshairs animate
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
 
let respawnListenerAdded = false;
function setupRespawnButton(canvas) {
  if (respawnListenerAdded) return;
  respawnListenerAdded = true;
  canvas.addEventListener("click", (e) => {
    const state = getState();
    if (!state.isDead || !state.canRespawn) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const bx = canvas.width / 2 - 100;
    const by = canvas.height / 2 + 85;
    if (mx >= bx && mx <= bx + 200 && my >= by && my <= by + 50) {
      respawn();
    }
  });
}
 
export function render(canvas, ctx) {
  setupRespawnButton(canvas);
  const { player, z, others, myId, projectiles, health, isDead, deathTimer, canRespawn } = getState();
  const rays = canvas.width;
  const jumpOffset = z * JUMP_SCALE;
  const horizon = canvas.height / 2 + jumpOffset;
 
  // Sky / floor
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, horizon);
  ctx.fillStyle = "#555";
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);
 
  // Walls
  const depth = [];
  let prevTileX = Math.floor(player.x);
  let prevTileY = Math.floor(player.y);
 
  for (let i = 0; i < rays; i++) {
    const rayAngle = player.angle - FOV / 2 + (i / rays) * FOV;
    const hit = castRay(rayAngle);
    const dist = hit.dist * Math.cos(rayAngle - player.angle);
    const height = canvas.height / Math.max(dist, 0.0001);
    depth[i] = dist;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(i, horizon - height / 2, 1, height);
    const hitX = player.x + Math.cos(rayAngle) * hit.dist;
    const hitY = player.y + Math.sin(rayAngle) * hit.dist;
    const tileX = Math.floor(hitX);
    const tileY = Math.floor(hitY);
    if (tileX !== prevTileX || tileY !== prevTileY) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(i, horizon - height / 2, 1, height);
    }
    prevTileX = tileX;
    prevTileY = tileY;
  }
 
  // Collect all sprites (projectiles + remote players)
  const allProjectiles = [...projectiles];
  for (const id in others) {
    if (id === myId) continue;
    allProjectiles.push(...(others[id].projectiles || []));
  }
 
  const sprites = [];
  for (const projectile of allProjectiles) {
    sprites.push({ type: "projectile", data: projectile });
  }
  for (const id in others) {
    if (id === myId) continue;
    sprites.push({ type: "player", id, data: others[id] });
  }
 
  // Farthest first
  sprites.sort((a, b) => {
    const dA = Math.hypot(a.data.x - player.x, a.data.y - player.y);
    const dB = Math.hypot(b.data.x - player.x, b.data.y - player.y);
    return dB - dA;
  });
 
  for (const sprite of sprites) {
    if (sprite.type === "projectile") {
      const proj = sprite.data;
      const dx = proj.x - player.x;
      const dy = proj.y - player.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) - player.angle;
      const norm = Math.atan2(Math.sin(angle), Math.cos(angle));
      if (Math.abs(norm) > FOV / 2) continue;
      const sx = (0.5 + norm / FOV) * canvas.width;
      const di = Math.floor(sx);
      if (di < 0 || di >= depth.length || depth[di] < dist) continue;
      const radius = Math.max(2, canvas.height / Math.max(dist * 10, 0.0001));
      const sy = horizon - radius - (proj.z || 0) * JUMP_SCALE;
      drawSphere(ctx, sx, sy, radius);
 
    } else {
      const p = sprite.data;
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) - player.angle;
      const norm = Math.atan2(Math.sin(angle), Math.cos(angle));
      if (Math.abs(norm) > FOV / 2) continue;
      const sx = (0.5 + norm / FOV) * canvas.width;
      const si = Math.floor(sx);
      if (si < 0 || si >= depth.length || depth[si] < dist) continue;
 
      const size      = canvas.height / Math.max(dist, 0.0001);
      const sy        = horizon - size / 2 - (p.z || 0) * JUMP_SCALE;
      const bodyWidth = size / 2;
      const bodyX     = sx - bodyWidth / 2;
 
      // ── Sprite or fallback rect ──────────────────────────────────────────
      const playerImg = getPlayerImage(sprite.id, p.sprite);
      let drawnX = bodyX, drawnW = bodyWidth;
 
      if (
        playerImg &&
        playerImg.complete &&
        !playerImg.__error &&
        playerImg.naturalWidth > 0
      ) {
        const aspect = playerImg.naturalWidth / playerImg.naturalHeight;
        drawnW = bodyWidth * aspect;
        drawnX = sx - drawnW / 2;
        // Drawing every frame is what makes GIF sprites animate
        ctx.drawImage(playerImg, drawnX, sy, drawnW, size);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(bodyX, sy, bodyWidth, size);
      }
 
      // ── Hitbox state border ──────────────────────────────────────────────
      const borderColor = hitboxColor(p);
      const borderW = Math.max(2, size * 0.025); // scales with distance
      ctx.save();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderW;
      // Flicker the border when invincible so it's extra obvious
      if (p.isInvincible) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 120);
      }
      ctx.strokeRect(drawnX, sy, drawnW, size);
      ctx.restore();
 
      // ── Username label ───────────────────────────────────────────────────
      const name = p.username || "Anonymous";
      const fontSize = Math.max(10, Math.min(18, size / 6));
      ctx.font = `${fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const labelY = sy - 6;
      const textWidth = ctx.measureText(name).width;
      const bgW = textWidth + 8;
      const bgH = fontSize + 4;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(sx - bgW / 2, labelY - bgH, bgW, bgH);
      ctx.fillStyle = "#fff";
      ctx.fillText(name, sx, labelY - 2);
 
      // ── Health bar ───────────────────────────────────────────────────────
      const remoteHealth = Number.isFinite(p.health) ? p.health : MAX_HEALTH;
      const barW = bodyWidth;
      const barH = Math.max(6, size * 0.07);
      drawHealthBar(ctx, sx - barW / 2, sy + size + 6, barW, barH, remoteHealth / MAX_HEALTH);
    }
  }
 
  // HUD
  drawMinimap(ctx);
  const hudW = Math.min(420, canvas.width * 0.55);
  drawHealthBar(ctx, 24, canvas.height - 50, hudW, 30, health / MAX_HEALTH);
  drawCrosshair(canvas, ctx);
 
  // Death screen
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
      const secondsLeft = Math.ceil((300 - deathTimer) / 60);
      ctx.font = "bold 28px Arial";
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillText(`Respawn available in ${secondsLeft}...`, canvas.width / 2 + 2, canvas.height / 2 + 42);
      ctx.fillStyle = "#ffcccc";
      ctx.fillText(`Respawn available in ${secondsLeft}...`, canvas.width / 2, canvas.height / 2 + 40);
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
    }
  }
}