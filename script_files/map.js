export const maps = [
  // old map
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

export let mapIndex = 1;
export let map = maps[mapIndex];
export const mapStr = "#";

// ── Geometry definitions ──────────────────────────────────────────────────────
//
// Map characters and what they do:
//
//  "#"  Full wall          — solid cube, full hitbox
//  "D"  Door (x-axis)      — slides open on E; hitbox shrinks as it opens
//  "Z"  Door (y-axis)      — same but y-axis
//  "/"  Diagonal NW→SE     — player collides with the diagonal line itself
//  "|"  Diagonal NE→SW     — same, opposite slope
//  "T"  Thin wall          — narrow centered wall, thin hitbox strip
//  "P"  Pillar             — round column, circular hitbox
//
export const GEOMETRY = {
  "#":  { type: "full",     solid: true,  render: true  },
  "F":  { type: "full",     solid: false, render: true  }, // false wall — visible but passable
  "/":  { type: "diagonal", solid: true,  render: true,  slope:  1 },
  "|": { type: "diagonal", solid: true,  render: true,  slope: -1 },
  "P":  { type: "pillar",   solid: true,  render: true,  radius: 0.15 },
};

export function getGeometry(char) {
  return GEOMETRY[char] ?? null;
}

const DEFAULT_COLLISION_PROXY_URL = "/assets/map.gltf";
const DEFAULT_CAD_MODEL_TRANSFORM = {
  rotationX: -Math.PI / 2,
  rotationY: 0,
  rotationZ: 0,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
};
const CAD_TRANSFORM_URL = "/assets/mapTransform.json";
const collisionProxyState = {
  ready: false,
  loading: null,
  triangles: [],
  transform: null,
};

function decodeDataUri(uri) {
  const match = String(uri || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const isBase64 = Boolean(match[2]);
  const data = match[3] || "";
  if (!isBase64) {
    return new TextEncoder().encode(decodeURIComponent(data)).buffer;
  }
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function loadBufferSource(uri, baseUrl) {
  if (!uri) return null;
  if (String(uri).startsWith("data:")) {
    return decodeDataUri(uri);
  }
  const resolvedUrl = baseUrl ? new URL(uri, baseUrl).href : uri;
  const response = await fetch(resolvedUrl);
  if (!response.ok) return null;
  return response.arrayBuffer();
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
  const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);

  if (componentType === 5126) {
    return new Float32Array(buffer, offset, count * itemSize);
  }
  if (componentType === 5125) {
    return new Uint32Array(buffer, offset, count * itemSize);
  }
  if (componentType === 5123) {
    return new Uint16Array(buffer, offset, count * itemSize);
  }
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
  x = nextX + transform.offsetX;
  y = nextY + transform.offsetY;
  z = z + transform.offsetZ;

  return { x, y, z };
}

async function loadCadTransform() {
  if (collisionProxyState.transform) return collisionProxyState.transform;
  try {
    const response = await fetch(CAD_TRANSFORM_URL);
    if (!response.ok) {
      collisionProxyState.transform = { ...DEFAULT_CAD_MODEL_TRANSFORM };
      return collisionProxyState.transform;
    }
    const json = await response.json();
    collisionProxyState.transform = normalizeCadTransform(json);
  } catch {
    collisionProxyState.transform = { ...DEFAULT_CAD_MODEL_TRANSFORM };
  }
  return collisionProxyState.transform;
}

function buildCollisionProxy(gltf, buffers) {
  const positions = gltf.meshes?.flatMap((mesh) => mesh.primitives || []) ?? [];
  const triangles = [];
  const primitiveData = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const primitive of positions) {
    const positionData = readAccessorData(gltf, buffers, primitive.attributes?.POSITION);
    const indexData = readAccessorData(gltf, buffers, primitive.indices);
    if (!positionData || !indexData) continue;

    const vertexCount = positionData.length / 3;
    const vertices = [];
    for (let i = 0; i < vertexCount; i++) {
      const vertex = {
        x: positionData[i * 3],
        y: positionData[i * 3 + 1],
        z: positionData[i * 3 + 2],
      };
      vertices.push(vertex);
      minX = Math.min(minX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxX = Math.max(maxX, vertex.x);
      maxY = Math.max(maxY, vertex.y);
    }

    primitiveData.push({ vertices, indexArray: Array.from(indexData) });
  }

  const centerX = Number.isFinite(minX) && Number.isFinite(maxX) ? (minX + maxX) * 0.5 : 0;
  const centerY = Number.isFinite(minY) && Number.isFinite(maxY) ? (minY + maxY) * 0.5 : 0;
  const centerPoint = applyCadTransform(
    { x: centerX, y: centerY, z: 0 },
    collisionProxyState.transform || DEFAULT_CAD_MODEL_TRANSFORM
  );

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

      const ta = applyCadTransform(a, collisionProxyState.transform || DEFAULT_CAD_MODEL_TRANSFORM);
      const tb = applyCadTransform(b, collisionProxyState.transform || DEFAULT_CAD_MODEL_TRANSFORM);
      const tc = applyCadTransform(c, collisionProxyState.transform || DEFAULT_CAD_MODEL_TRANSFORM);

      const tri = [
        { x: ta.x - centerPoint.x, y: ta.z - centerPoint.z },
        { x: tb.x - centerPoint.x, y: tb.z - centerPoint.z },
        { x: tc.x - centerPoint.x, y: tc.z - centerPoint.z },
      ];

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

async function ensureCollisionProxy() {
  if (collisionProxyState.ready || collisionProxyState.loading) return collisionProxyState.loading;
  collisionProxyState.loading = (async () => {
    try {
      collisionProxyState.transform = await loadCadTransform();
      const response = await fetch(DEFAULT_COLLISION_PROXY_URL);
      if (!response.ok) return;
      const gltf = await response.json();
      const buffers = await Promise.all((gltf.buffers || []).map((buffer) => loadBufferSource(buffer.uri, response.url)));
      collisionProxyState.triangles = buildCollisionProxy(gltf, buffers);
      collisionProxyState.ready = collisionProxyState.triangles.length > 0;
    } catch {
      collisionProxyState.ready = false;
      collisionProxyState.triangles = [];
    }
  })();
  return collisionProxyState.loading;
}

ensureCollisionProxy();

function collisionProxyHits(x, y) {
  const point = { x, y };
  for (const tri of collisionProxyState.triangles) {
    if (pointInTriangle(point, tri[0], tri[1], tri[2])) return true;
  }
  return false;
}
/*
// ── Door animation state ──────────────────────────────────────────────────────
const doorStates = {};

export function toggleDoor(mapX, mapY) {
  const key = `${mapX},${mapY}`;
  if (!doorStates[key]) doorStates[key] = { openAmount: 0, opening: false };
  doorStates[key].opening = !doorStates[key].opening;
}

export function updateDoors(dt) {
  for (const key in doorStates) {
    const d = doorStates[key];
    if (d.opening) d.openAmount = Math.min(1, d.openAmount + 1.5 * dt);
    else           d.openAmount = Math.max(0, d.openAmount - 1.5 * dt);
    const [mx, my] = key.split(",").map(Number);
    const geo = GEOMETRY[map[my]?.[mx]];
    if (geo?.type === "door") geo.openAmount = d.openAmount;
  }
}
*/
// ── isWall ────────────────────────────────────────────────────────────────────
// Drop-in replacement for the original. Same call signature.
// player.js calls this at 4 corners of the player bounding box — each corner
// gets the precise geometry test for its tile, so hitboxes match visuals.

export function isWall(x, y) {
  if (collisionProxyState.ready && collisionProxyState.triangles.length) {
    return collisionProxyHits(x, y);
  }

  return false;
}
