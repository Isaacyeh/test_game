import { MINIMAP_SCALE, MINIMAP_PADDING } from "./constant";

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
