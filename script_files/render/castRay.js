import { getState } from "../player.js";
import { map, getGeometry } from "../map.js";

// ── castRay ───────────────────────────────────────────────────────────────────
// Returns { dist, vertical, heightScale, yOffset, wallX }
//   dist        – perpendicular distance to the hit surface
//   vertical    – true if the hit was on an east/west face (for shading)
//   heightScale – fraction of full wall height to draw  (1.0 = full, 0.5 = slab)
//   yOffset     – vertical shift of the strip in screen-space (-0.5 = ceiling slab)
//   wallX       – fractional hit position along the wall face (0..1), for textures

export function castRay(angle) {
  const { player } = getState();
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  // ── DDA setup ─────────────────────────────────────────────────────────────
  let mapX = Math.floor(player.x);
  let mapY = Math.floor(player.y);

  const deltaDistX = Math.abs(dirX) < 1e-10 ? 1e30 : Math.abs(1 / dirX);
  const deltaDistY = Math.abs(dirY) < 1e-10 ? 1e30 : Math.abs(1 / dirY);

  let stepX, sideDistX;
  if (dirX < 0) { stepX = -1; sideDistX = (player.x - mapX) * deltaDistX; }
  else          { stepX =  1; sideDistX = (mapX + 1 - player.x) * deltaDistX; }

  let stepY, sideDistY;
  if (dirY < 0) { stepY = -1; sideDistY = (player.y - mapY) * deltaDistY; }
  else          { stepY =  1; sideDistY = (mapY + 1 - player.y) * deltaDistY; }

  const MAX_DIST = 20;

  // ── March ─────────────────────────────────────────────────────────────────
  for (let guard = 0; guard < 200; guard++) {
    let side; // 0 = EW face, 1 = NS face
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }

    // Perpendicular distance to this cell boundary
    const perpDist = side === 0
      ? (mapX - player.x + (1 - stepX) / 2) / dirX
      : (mapY - player.y + (1 - stepY) / 2) / dirY;

    if (perpDist > MAX_DIST) break;

    const char = map[mapY]?.[mapX];
    if (!char || char === "-" || char === " ") continue;

    const geo = getGeometry(char);
    if (!geo) continue;

    // ── Full wall ────────────────────────────────────────────────────────
    if (geo.type === "full") {
      const wallX = side === 0
        ? player.y + perpDist * dirY - Math.floor(player.y + perpDist * dirY)
        : player.x + perpDist * dirX - Math.floor(player.x + perpDist * dirX);
      return { dist: perpDist, vertical: side === 0, heightScale: 1, yOffset: 0, wallX };
    }

    // ── Slab (half-height wall) ──────────────────────────────────────────
    if (geo.type === "slab") {
      const wallX = side === 0
        ? player.y + perpDist * dirY - Math.floor(player.y + perpDist * dirY)
        : player.x + perpDist * dirX - Math.floor(player.x + perpDist * dirX);
      return {
        dist: perpDist,
        vertical: side === 0,
        heightScale: geo.heightScale,
        yOffset: geo.yOffset,
        wallX,
      };
    }

    // ── Door ─────────────────────────────────────────────────────────────
    // Door panel lives at 0.5 into the cell along its axis.
    // If the panel has slid out of the ray's path (openAmount), ray continues.
    if (geo.type === "door") {
      const hit = castDoor(player, dirX, dirY, mapX, mapY, geo);
      if (hit) return hit;
      continue; // ray passes through open door
    }

    // ── Diagonal ─────────────────────────────────────────────────────────
    if (geo.type === "diagonal") {
      const hit = castDiagonal(player, dirX, dirY, mapX, mapY, geo);
      if (hit) return hit;
      continue;
    }

    // ── Thin wall ────────────────────────────────────────────────────────
    if (geo.type === "thin") {
      const hit = castThin(player, dirX, dirY, mapX, mapY, geo);
      if (hit) return hit;
      continue;
    }

    // ── Pillar ───────────────────────────────────────────────────────────
    if (geo.type === "pillar") {
      const hit = castPillar(player, dirX, dirY, mapX, mapY, geo);
      if (hit) return hit;
      continue;
    }
  }

  return { dist: MAX_DIST, vertical: false, heightScale: 1, yOffset: 0, wallX: 0 };
}

// ── Door ──────────────────────────────────────────────────────────────────────
// The door panel sits at cell_origin + 0.5 on its axis and spans the full cell
// on the other axis. It slides out of the way as openAmount → 1.
function castDoor(player, dirX, dirY, mapX, mapY, geo) {
  const panelOffset = 0.5; // panel at mid-cell

  let t;
  let wallX;

  if (geo.axis === "x") {
    // Panel is a horizontal line at y = mapY + 0.5
    if (Math.abs(dirY) < 1e-10) return null;
    t = (mapY + panelOffset - player.y) / dirY;
    if (t <= 0) return null;
    wallX = player.x + t * dirX - mapX;
  } else {
    // Panel is a vertical line at x = mapX + 0.5
    if (Math.abs(dirX) < 1e-10) return null;
    t = (mapX + panelOffset - player.x) / dirX;
    if (t <= 0) return null;
    wallX = player.y + t * dirY - mapY;
  }

  if (wallX < 0 || wallX > 1) return null;

  // Door slides: the panel occupies [openAmount, 1] in wallX space.
  // A ray hitting the open gap (wallX < openAmount) passes through.
  const open = geo.openAmount ?? 0;
  if (wallX < open) return null;

  // Remap wallX so texture starts at the panel's visible edge
  const texX = (wallX - open) / (1 - open + 1e-6);

  return {
    dist: t,
    vertical: geo.axis === "x",
    heightScale: 1,
    yOffset: 0,
    wallX: texX,
    isDoor: true,
  };
}

// ── Diagonal ──────────────────────────────────────────────────────────────────
// slope = 1  → line from (mapX, mapY+1) to (mapX+1, mapY)   (top-right / bottom-left)
// slope = -1 → line from (mapX, mapY)   to (mapX+1, mapY+1) (top-left  / bottom-right)
//
// Parametric ray: P(t) = player + t * dir
// Line equation (slope 1):  x + y = mapX + mapY + 1
//   → (px + t*dx) + (py + t*dy) = C  → t = (C - px - py) / (dx + dy)
// Line equation (slope -1): x - y = mapX - mapY
//   → t = (C - px + py) / (dx - dy)
function castDiagonal(player, dirX, dirY, mapX, mapY, geo) {
  let t;

  if (geo.slope === 1) {
    const denom = dirX + dirY;
    if (Math.abs(denom) < 1e-10) return null;
    const C = mapX + mapY + 1;
    t = (C - player.x - player.y) / denom;
  } else {
    const denom = dirX - dirY;
    if (Math.abs(denom) < 1e-10) return null;
    const C = mapX - mapY;
    t = (C - player.x + player.y) / denom;
  }

  if (t <= 0) return null;

  const hitX = player.x + t * dirX;
  const hitY = player.y + t * dirY;

  // Must land within the cell square
  if (hitX < mapX || hitX > mapX + 1 || hitY < mapY || hitY > mapY + 1) return null;

  // wallX is distance along the diagonal (0..1) — used as texture coord
  const wallX = hitX - mapX;

  return { dist: t, vertical: false, heightScale: 1, yOffset: 0, wallX, isDiagonal: true };
}

// ── Thin wall ─────────────────────────────────────────────────────────────────
// A thin wall is a flat plane inside the cell at planeOffset depth from the
// cell's north/south edges. The ray tests both faces of the slab.
function castThin(player, dirX, dirY, mapX, mapY, geo) {
  const off = geo.planeOffset ?? 0.45;
  const candidates = [];

  // Test the two Y-axis-parallel planes (at mapY + off and mapY + off + thickness)
  for (const planeY of [mapY + off, mapY + off + (geo.thickness ?? 0.1)]) {
    if (Math.abs(dirY) < 1e-10) continue;
    const t = (planeY - player.y) / dirY;
    if (t <= 0) continue;
    const hitX = player.x + t * dirX;
    if (hitX >= mapX && hitX <= mapX + 1) {
      candidates.push({ t, wallX: hitX - mapX });
    }
  }

  // Test the two X-axis-parallel planes (at mapX + off and mapX + off + thickness)
  for (const planeX of [mapX + off, mapX + off + (geo.thickness ?? 0.1)]) {
    if (Math.abs(dirX) < 1e-10) continue;
    const t = (planeX - player.x) / dirX;
    if (t <= 0) continue;
    const hitY = player.y + t * dirY;
    if (hitY >= mapY && hitY <= mapY + 1) {
      candidates.push({ t, wallX: hitY - mapY });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.t - b.t);
  const { t, wallX } = candidates[0];
  return { dist: t, vertical: false, heightScale: 1, yOffset: 0, wallX, isThin: true };
}

// ── Pillar ────────────────────────────────────────────────────────────────────
// Treats the cell as containing a circle of the given radius centered at
// (mapX + 0.5, mapY + 0.5). Solves the ray-circle intersection analytically.
function castPillar(player, dirX, dirY, mapX, mapY, geo) {
  const cx = mapX + 0.5;
  const cy = mapY + 0.5;
  const r  = geo.radius ?? 0.2;

  // Shift origin to circle centre
  const ox = player.x - cx;
  const oy = player.y - cy;

  const a = dirX * dirX + dirY * dirY;
  const b = 2 * (ox * dirX + oy * dirY);
  const c = ox * ox + oy * oy - r * r;

  const disc = b * b - 4 * a * c;
  if (disc < 0) return null; // no intersection

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  const t = t1 > 0 ? t1 : (t2 > 0 ? t2 : null);
  if (t === null) return null;

  // wallX from hit angle around the circle (0..1 wrapping)
  const hitX = player.x + t * dirX;
  const hitY = player.y + t * dirY;
  const hitAngle = Math.atan2(hitY - cy, hitX - cx);
  const wallX = (hitAngle / (2 * Math.PI) + 1) % 1;

  return { dist: t, vertical: false, heightScale: 1, yOffset: 0, wallX, isPillar: true };
}