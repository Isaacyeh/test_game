import { getState } from "../player.js";
import { map, getGeometry } from "../map.js";

// castRay returns { dist, vertical, heightScale, yOffset, wallX }
// dist is RAW ray distance so render.js fish-eye fix works unchanged:
//   const dist = hit.dist * Math.cos(rayAngle - player.angle)

const MIN_DIST = 0.05; // never return a wall closer than this — prevents
                        // infinite wall height when player grazes a surface

export function castRay(angle) {
  const { player } = getState();
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

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

  // cosAngleDiff converts perpendicular dist → raw ray dist.
  // Clamp away from zero so we never divide by a tiny number.
  // Math.cos(angle - player.angle) is always in [-1,1]; for a valid
  // FOV (< 180°) the rays in front always give a positive value,
  // but floating-point wobble can push it slightly negative at the
  // very edge columns. Taking the absolute value is safe because
  // perpDist is already positive and we only care about magnitude.
  const cosAngleDiff = Math.max(Math.abs(Math.cos(angle - player.angle)), 0.001);

  for (let guard = 0; guard < 300; guard++) {
    let side;
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }

    const perpDist = side === 0
      ? (mapX - player.x + (1 - stepX) / 2) / dirX
      : (mapY - player.y + (1 - stepY) / 2) / dirY;

    // Skip hits that are behind the player or too close (avoids
    // the wall the player is currently inside from flash-rendering)
    if (perpDist < MIN_DIST) continue;
    if (perpDist > MAX_DIST) break;

    const char = map[mapY]?.[mapX];
    if (!char || char === "-" || char === " ") continue;

    const geo = getGeometry(char);
    if (!geo) continue;

    // false walls (solid:false) are visible but ray passes through them
    // so the player sees the wall behind — gives a "secret passage" look
    if (!geo.solid && geo.type !== "full") continue;
    // For "full" type specifically check the render flag; false walls
    // have type "full" with solid:false so we still render them but
    // don't block the ray (continue so we see whatever is behind)
    if (geo.type === "full" && !geo.solid) continue;

    const rawDist = perpDist / cosAngleDiff;

    if (geo.type === "full") {
      return {
        dist:        rawDist,
        vertical:    side === 0,
        heightScale: 1,
        yOffset:     0,
        wallX:       getWallX(player, dirX, dirY, mapX, mapY, side, perpDist),
      };
    }

    if (geo.type === "slab") {
      return {
        dist:        rawDist,
        vertical:    side === 0,
        heightScale: geo.heightScale,
        yOffset:     geo.yOffset,
        wallX:       getWallX(player, dirX, dirY, mapX, mapY, side, perpDist),
      };
    }

    if (geo.type === "door") {
      const hit = castDoor(player, dirX, dirY, cosAngleDiff, mapX, mapY, geo, MIN_DIST);
      if (hit) return hit;
      continue;
    }

    if (geo.type === "diagonal") {
      const hit = castDiagonal(player, dirX, dirY, cosAngleDiff, mapX, mapY, geo, MIN_DIST);
      if (hit) return hit;
      continue;
    }

    if (geo.type === "thin") {
      const hit = castThin(player, dirX, dirY, cosAngleDiff, mapX, mapY, geo, MIN_DIST);
      if (hit) return hit;
      continue;
    }

    if (geo.type === "pillar") {
      const hit = castPillar(player, dirX, dirY, cosAngleDiff, mapX, mapY, geo, MIN_DIST);
      if (hit) return hit;
      continue;
    }
  }

  return { dist: MAX_DIST, vertical: false, heightScale: 1, yOffset: 0, wallX: 0 };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWallX(player, dirX, dirY, mapX, mapY, side, perpDist) {
  if (side === 0) {
    const y = player.y + perpDist * dirY;
    return y - Math.floor(y);
  }
  const x = player.x + perpDist * dirX;
  return x - Math.floor(x);
}

function castDoor(player, dirX, dirY, cosAngleDiff, mapX, mapY, geo, minDist) {
  let t, wallX;
  if (geo.axis === "x") {
    if (Math.abs(dirY) < 1e-10) return null;
    t = (mapY + 0.5 - player.y) / dirY;
    if (t < minDist) return null;
    wallX = player.x + t * dirX - mapX;
  } else {
    if (Math.abs(dirX) < 1e-10) return null;
    t = (mapX + 0.5 - player.x) / dirX;
    if (t < minDist) return null;
    wallX = player.y + t * dirY - mapY;
  }
  if (wallX < 0 || wallX > 1) return null;
  const open = geo.openAmount ?? 0;
  if (wallX < open) return null;
  return {
    dist:        t / cosAngleDiff,
    vertical:    geo.axis === "x",
    heightScale: 1,
    yOffset:     0,
    wallX:       wallX - open,
    isDoor:      true,
  };
}

function castDiagonal(player, dirX, dirY, cosAngleDiff, mapX, mapY, geo, minDist) {
  let t;
  if (geo.slope === 1) {
    const denom = dirX + dirY;
    if (Math.abs(denom) < 1e-10) return null;
    t = (mapX + mapY + 1 - player.x - player.y) / denom;
  } else {
    const denom = dirX - dirY;
    if (Math.abs(denom) < 1e-10) return null;
    t = (mapX - mapY - player.x + player.y) / denom;
  }
  if (t < minDist) return null;
  const hitX = player.x + t * dirX;
  const hitY = player.y + t * dirY;
  if (hitX < mapX || hitX > mapX + 1 || hitY < mapY || hitY > mapY + 1) return null;
  return {
    dist:        t / cosAngleDiff,
    vertical:    false,
    heightScale: 1,
    yOffset:     0,
    wallX:       hitX - mapX,
    isDiagonal:  true,
  };
}

function castThin(player, dirX, dirY, cosAngleDiff, mapX, mapY, geo, minDist) {
  const off   = geo.planeOffset ?? 0.45;
  const thick = geo.thickness   ?? 0.1;
  const candidates = [];

  for (const py of [mapY + off, mapY + off + thick]) {
    if (Math.abs(dirY) < 1e-10) continue;
    const t = (py - player.y) / dirY;
    if (t < minDist) continue;
    const hx = player.x + t * dirX;
    if (hx >= mapX && hx <= mapX + 1) candidates.push({ t, wallX: hx - mapX });
  }
  for (const px of [mapX + off, mapX + off + thick]) {
    if (Math.abs(dirX) < 1e-10) continue;
    const t = (px - player.x) / dirX;
    if (t < minDist) continue;
    const hy = player.y + t * dirY;
    if (hy >= mapY && hy <= mapY + 1) candidates.push({ t, wallX: hy - mapY });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.t - b.t);
  const { t, wallX } = candidates[0];
  return {
    dist:        t / cosAngleDiff,
    vertical:    false,
    heightScale: 1,
    yOffset:     0,
    wallX,
    isThin:      true,
  };
}

function castPillar(player, dirX, dirY, cosAngleDiff, mapX, mapY, geo, minDist) {
  const cx = mapX + 0.5;
  const cy = mapY + 0.5;
  const r  = geo.radius ?? 0.2;
  const ox = player.x - cx;
  const oy = player.y - cy;
  // a = 1 because dir is a unit vector
  const b    = 2 * (ox * dirX + oy * dirY);
  const c    = ox * ox + oy * oy - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / 2;
  const t2 = (-b + sq) / 2;
  const t  = t1 >= minDist ? t1 : (t2 >= minDist ? t2 : null);
  if (t === null) return null;
  const hitX  = player.x + t * dirX;
  const hitY  = player.y + t * dirY;
  const wallX = (Math.atan2(hitY - cy, hitX - cx) / (2 * Math.PI) + 1) % 1;
  return {
    dist:        t / cosAngleDiff,
    vertical:    false,
    heightScale: 1,
    yOffset:     0,
    wallX,
    isPillar:    true,
  };
}