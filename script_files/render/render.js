import { FOV, RAYS, JUMP_SCALE } from "./script_files/constant.js";
import { player } from ".script_files/chat.js";

function render(drawMinimap, castRay) {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const jumpOffset = z * JUMP_SCALE;
  const horizon = canvas.height / 2 + jumpOffset;

  // Sky
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, horizon);

  // Floor
  ctx.fillStyle = "#555";
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);

  const depth = [];

  let prevTileX = Math.floor(player.x);
  let prevTileY = Math.floor(player.y);

  for (let i = 0; i < RAYS; i++) {
    const rayAngle = player.angle - FOV / 2 + (i / RAYS) * FOV;
    const hit = castRay;
    const dist = hit.dist * Math.cos(rayAngle - player.angle);
    const height = canvas.height / dist;

    depth[i] = dist;

    // Determine wall face color
    const faceColor = "#ffffff"; // main face color
    const edgeColor = "#000000"; // edge color

    // Draw main face
    ctx.fillStyle = faceColor;
    ctx.fillRect(i, horizon - height / 2, 1, height);

    // --- Edge detection: check if ray crossed tile boundary ---
    const hitX = player.x + Math.cos(rayAngle) * hit.dist;
    const hitY = player.y + Math.sin(rayAngle) * hit.dist;

    const tileX = Math.floor(hitX);
    const tileY = Math.floor(hitY);

    // If the ray is entering a new tile horizontally or vertically, draw edge
    if (tileX !== prevTileX || tileY !== prevTileY) {
      ctx.fillStyle = edgeColor;
      ctx.fillRect(i, horizon - height / 2, 1, height);
    }

    prevTileX = tileX;
    prevTileY = tileY;
  }

  // Draw other players
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

  drawMinimap;
  requestAnimationFrame(loop);
}
