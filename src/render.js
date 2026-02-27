// render.js
// raycasting and drawing routines

import { player, others, myId } from "./player.js";
import { FOV, JUMP_SCALE, MINIMAP_SCALE, MINIMAP_PADDING, canvas, ctx } from "./constants.js";
import { isWall, map, mapStr } from "./map.js";
import { updateState } from "./update.js";

// depth buffer used for occlusion of other players
let depth = [];

function castRay(angle) {
  const sin = Math.sin(angle),
    cos = Math.cos(angle);
  let d = 0,
    prevX = player.x,
    prevY = player.y;

  while (d < 20) {
    const x = player.x + cos * d;
    const y = player.y + sin * d;
    if (isWall(x, y))
      return { dist: d, vertical: Math.floor(x) !== Math.floor(prevX) };
    prevX = x;
    prevY = y;
    d += 0.02;
  }
  return { dist: 20, vertical: false };
}

function drawMinimap() {
  const VIEW_RADIUS = 12;
  const startX = MINIMAP_PADDING,
    startY = MINIMAP_PADDING;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(
    startX - 4,
    startY - 4,
    VIEW_RADIUS * 2 * MINIMAP_SCALE + 8,
    VIEW_RADIUS * 2 * MINIMAP_SCALE + 8
  );

  const centerX = Math.floor(player.x),
    centerY = Math.floor(player.y);

  for (let y = -VIEW_RADIUS; y < VIEW_RADIUS; y++) {
    for (let x = -VIEW_RADIUS; x < VIEW_RADIUS; x++) {
      const mapX = centerX + x,
        mapY = centerY + y;
      if (map[mapY]?.[mapX] === mapStr) {
        ctx.fillStyle = "#888";
        ctx.fillRect(
          startX + (x + VIEW_RADIUS) * MINIMAP_SCALE,
          startY + (y + VIEW_RADIUS) * MINIMAP_SCALE,
          MINIMAP_SCALE,
          MINIMAP_SCALE
        );
      }
    }
  }

  for (const id in others) {
    if (id === myId) continue;
    const p = others[id];
    const dx = p.x - player.x,
      dy = p.y - player.y;
    if (Math.abs(dx) > VIEW_RADIUS || Math.abs(dy) > VIEW_RADIUS) continue;
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(
      startX + (dx + VIEW_RADIUS) * MINIMAP_SCALE,
      startY + (dy + VIEW_RADIUS) * MINIMAP_SCALE,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.fillStyle = "lime";
  ctx.beginPath();
  ctx.arc(
    startX + VIEW_RADIUS * MINIMAP_SCALE + VIEW_RADIUS / 2,
    startY + VIEW_RADIUS * MINIMAP_SCALE + VIEW_RADIUS / 2,
    4,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

export function renderFrame() {
  const jumpOffset = player.z * JUMP_SCALE;
  const horizon = canvas.height / 2 + jumpOffset;

  // sky
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, horizon);

  // floor
  ctx.fillStyle = "#555";
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);

  depth = [];

  const RAYS = canvas.width;
  let prevTileX = Math.floor(player.x);
  let prevTileY = Math.floor(player.y);

  for (let i = 0; i < RAYS; i++) {
    const rayAngle = player.angle - FOV / 2 + (i / RAYS) * FOV;
    const hit = castRay(rayAngle);
    const dist = hit.dist * Math.cos(rayAngle - player.angle);
    const height = canvas.height / dist;

    depth[i] = dist;

    // Determine wall face color
    const faceColor = "#ffffff";
    const edgeColor = "#000000";

    // Draw main face
    ctx.fillStyle = faceColor;
    ctx.fillRect(i, horizon - height / 2, 1, height);

    // --- Edge detection: check if ray crossed tile boundary ---
    const hitX = player.x + Math.cos(rayAngle) * hit.dist;
    const hitY = player.y + Math.sin(rayAngle) * hit.dist;

    const tileX = Math.floor(hitX);
    const tileY = Math.floor(hitY);

    if (tileX !== prevTileX || tileY !== prevTileY) {
      ctx.fillStyle = edgeColor;
      ctx.fillRect(i, horizon - height / 2, 1, height);
    }

    prevTileX = tileX;
    prevTileY = tileY;
  }

  // draw other players
  for (const id in others) {
    if (id === myId) continue;
    const p = others[id];

    const dx = p.x - player.x;
    const dy = p.y - player.y;
    const dist = Math.hypot(dx, dy);

    const angle = Math.atan2(dy, dx) - player.angle;
    const norm = Math.atan2(Math.sin(angle), Math.cos(angle));
    if (Math.abs(norm) > FOV / 2) continue;

    const sx = (0.5 + norm / FOV) * canvas.width;
    if (depth[Math.floor(sx)] < dist) continue;

    const size = canvas.height / dist;
    const sy = horizon - size / 2 - (p.z || 0) * JUMP_SCALE;

    ctx.fillStyle = "red";
    ctx.fillRect(sx - size / 4, sy, size / 2, size);
  }

  drawMinimap();
}

export function loop() {
  updateState();
  renderFrame();
  requestAnimationFrame(loop);
}
