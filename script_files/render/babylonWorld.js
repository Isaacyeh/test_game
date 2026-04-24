import { Engine } from "../../node_modules/@babylonjs/core/Engines/engine.js";
import { Scene } from "../../node_modules/@babylonjs/core/scene.js";
import { FreeCamera } from "../../node_modules/@babylonjs/core/Cameras/freeCamera.js";
import { HemisphericLight } from "../../node_modules/@babylonjs/core/Lights/hemisphericLight.js";
import { SceneLoader } from "../../node_modules/@babylonjs/core/Loading/sceneLoader.js";
import { MeshBuilder } from "../../node_modules/@babylonjs/core/Meshes/meshBuilder.js";
import { TransformNode } from "../../node_modules/@babylonjs/core/Meshes/transformNode.js";
import { StandardMaterial } from "../../node_modules/@babylonjs/core/Materials/standardMaterial.js";
import { Vector3 } from "../../node_modules/@babylonjs/core/Maths/math.vector.js";
import { Color3, Color4 } from "../../node_modules/@babylonjs/core/Maths/math.color.js";
import "../../node_modules/@babylonjs/loaders/glTF/index.js";

import { FOV } from "../constant.js";
import { map, getGeometry } from "../map.js";

const worldState = {
  engine: null,
  scene: null,
  camera: null,
  worldRoot: null,
  mapRef: null,
  resizeHandler: null,
  cadChecked: false,
  cadLoaded: false,
  cadLoadPromise: null,
  cadModelUrl: null,
  cadTransform: null,
  localAvatarTransform: null,
  localAvatarLoadPromise: null,
  localAvatarRoot: null,
  localAvatarAnimations: null,
  localAvatarActiveAnimation: null,
  localAvatarLastAngle: null,
  localAvatarVisualAngle: null,
  localAvatarTurnLean: 0,
  remoteAvatarMeshes: new Map(),
};

const DEFAULT_CAD_MAP_URLS = ["/assets/map.gltf", "/assets/map.glb"];
const LOCAL_AVATAR_URL = "/assets/BaseCharacter.gltf";
const CHARACTER_TRANSFORM_URL = "/assets/characterTransform.json";
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
const DEFAULT_AVATAR_MODEL_TRANSFORM = {
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  targetHeight: 1.75,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  tintColor: null,
  bodyTintColor: null,
  eyeTintColor: null,
  eyeEmissiveColor: null,
  eyeMatch: ["eye", "iris", "pupil"],
  emissiveColor: null,
  opacity: 1,
  hideHead: false,
};

function createMaterial(scene, name, color, alpha = 1) {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.emissiveColor = color;
  material.specularColor = Color3.Black();
  material.alpha = alpha;
  return material;
}

function findAnimationGroup(animationGroups, pattern) {
  return animationGroups?.find((group) => pattern.test(group.name)) ?? null;
}

function findAnimationGroupByName(animationGroups, name) {
  return animationGroups?.find((group) => String(group.name || "").toLowerCase() === name.toLowerCase()) ?? null;
}

function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function normalizeAvatarTransform(transform) {
  const rotation = transform?.rotation || {};
  const scale = transform?.scale3 || {};
  const offset = transform?.offset || {};
  return {
    rotationX: Number.isFinite(transform?.rotationX) ? transform.rotationX : Number(rotation.x ?? DEFAULT_AVATAR_MODEL_TRANSFORM.rotationX),
    rotationY: Number.isFinite(transform?.rotationY) ? transform.rotationY : Number(rotation.y ?? DEFAULT_AVATAR_MODEL_TRANSFORM.rotationY),
    rotationZ: Number.isFinite(transform?.rotationZ) ? transform.rotationZ : Number(rotation.z ?? DEFAULT_AVATAR_MODEL_TRANSFORM.rotationZ),
    targetHeight: Number.isFinite(transform?.targetHeight) ? transform.targetHeight : DEFAULT_AVATAR_MODEL_TRANSFORM.targetHeight,
    scale: Number.isFinite(transform?.scale) ? transform.scale : DEFAULT_AVATAR_MODEL_TRANSFORM.scale,
    scaleX: Number.isFinite(transform?.scaleX) ? transform.scaleX : Number(scale.x ?? DEFAULT_AVATAR_MODEL_TRANSFORM.scaleX),
    scaleY: Number.isFinite(transform?.scaleY) ? transform.scaleY : Number(scale.y ?? DEFAULT_AVATAR_MODEL_TRANSFORM.scaleY),
    scaleZ: Number.isFinite(transform?.scaleZ) ? transform.scaleZ : Number(scale.z ?? DEFAULT_AVATAR_MODEL_TRANSFORM.scaleZ),
    offsetX: Number.isFinite(transform?.offsetX) ? transform.offsetX : Number(offset.x ?? DEFAULT_AVATAR_MODEL_TRANSFORM.offsetX),
    offsetY: Number.isFinite(transform?.offsetY) ? transform.offsetY : Number(offset.y ?? DEFAULT_AVATAR_MODEL_TRANSFORM.offsetY),
    offsetZ: Number.isFinite(transform?.offsetZ) ? transform.offsetZ : Number(offset.z ?? DEFAULT_AVATAR_MODEL_TRANSFORM.offsetZ),
    tintColor: typeof transform?.tintColor === "string" ? transform.tintColor : DEFAULT_AVATAR_MODEL_TRANSFORM.tintColor,
    bodyTintColor: typeof transform?.bodyTintColor === "string" ? transform.bodyTintColor : DEFAULT_AVATAR_MODEL_TRANSFORM.bodyTintColor,
    eyeTintColor: typeof transform?.eyeTintColor === "string" ? transform.eyeTintColor : DEFAULT_AVATAR_MODEL_TRANSFORM.eyeTintColor,
    eyeEmissiveColor: typeof transform?.eyeEmissiveColor === "string" ? transform.eyeEmissiveColor : DEFAULT_AVATAR_MODEL_TRANSFORM.eyeEmissiveColor,
    eyeMatch: Array.isArray(transform?.eyeMatch)
      ? transform.eyeMatch.map((token) => String(token || "").toLowerCase()).filter(Boolean)
      : [...DEFAULT_AVATAR_MODEL_TRANSFORM.eyeMatch],
    emissiveColor: typeof transform?.emissiveColor === "string" ? transform.emissiveColor : DEFAULT_AVATAR_MODEL_TRANSFORM.emissiveColor,
    opacity: Number.isFinite(transform?.opacity) ? Math.min(1, Math.max(0, transform.opacity)) : DEFAULT_AVATAR_MODEL_TRANSFORM.opacity,
    hideHead: Boolean(transform?.hideHead),
  };
}

function isEyeMaterial(material, meshNames, eyeTokens) {
  const matName = String(material?.name || "").toLowerCase();
  if (eyeTokens.some((token) => matName.includes(token))) return true;
  return meshNames.some((meshName) => eyeTokens.some((token) => meshName.includes(token)));
}

function parseHexColor(input) {
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/^#/, "");
  if (!/^([0-9a-fA-F]{6})$/.test(raw)) return null;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  return new Color3(r, g, b);
}

function applyAvatarAppearance(meshes, transform) {
  const tintColor = parseHexColor(transform.tintColor);
  const bodyTintColor = parseHexColor(transform.bodyTintColor) || tintColor;
  const eyeTintColor = parseHexColor(transform.eyeTintColor);
  const eyeEmissiveColor = parseHexColor(transform.eyeEmissiveColor);
  const emissiveColor = parseHexColor(transform.emissiveColor);
  const materialToMeshNames = new Map();
  const eyeTokens = (transform.eyeMatch || []).map((token) => String(token).toLowerCase()).filter(Boolean);

  for (const mesh of meshes || []) {
    const lowerName = String(mesh.name || "").toLowerCase();
    if (transform.hideHead && lowerName.includes("head")) {
      mesh.setEnabled(false);
    }
    if (mesh.material) {
      if (!materialToMeshNames.has(mesh.material)) {
        materialToMeshNames.set(mesh.material, []);
      }
      materialToMeshNames.get(mesh.material).push(lowerName);
    }
  }

  for (const [material, meshNames] of materialToMeshNames.entries()) {
    const eyeMaterial = isEyeMaterial(material, meshNames, eyeTokens);
    const tint = eyeMaterial ? eyeTintColor : bodyTintColor;
    material.alpha = transform.opacity;
    if (tint) {
      if (material.albedoColor) material.albedoColor = tint.clone();
      if (material.diffuseColor) material.diffuseColor = tint.clone();
    }
    if (material.emissiveColor) {
      if (eyeMaterial && eyeEmissiveColor) {
        material.emissiveColor = eyeEmissiveColor.clone();
      } else if (emissiveColor) {
        material.emissiveColor = emissiveColor.clone();
      }
    }
  }
}

async function loadAvatarTransform() {
  if (worldState.localAvatarTransform) return worldState.localAvatarTransform;
  try {
    const response = await fetch(CHARACTER_TRANSFORM_URL);
    if (!response.ok) {
      worldState.localAvatarTransform = { ...DEFAULT_AVATAR_MODEL_TRANSFORM };
      return worldState.localAvatarTransform;
    }
    const json = await response.json();
    worldState.localAvatarTransform = normalizeAvatarTransform(json);
  } catch {
    worldState.localAvatarTransform = { ...DEFAULT_AVATAR_MODEL_TRANSFORM };
  }
  return worldState.localAvatarTransform;
}

async function loadLocalAvatar(scene) {
  if (worldState.localAvatarLoadPromise) return worldState.localAvatarLoadPromise;

  worldState.localAvatarLoadPromise = (async () => {
    const result = await SceneLoader.ImportMeshAsync("", "/assets/", "BaseCharacter.gltf", scene);
    const root = new TransformNode("localAvatarRoot", scene);
    const visual = new TransformNode("localAvatarVisual", scene);
    visual.parent = root;

    for (const mesh of result.meshes || []) {
      if (mesh === root) continue;
      if (!mesh.parent) mesh.parent = visual;
      if (mesh.name === "__root__") continue;
      mesh.isPickable = false;
    }

    const transform = await loadAvatarTransform();
    const bounds = visual.getHierarchyBoundingVectors(true);
    const height = Math.max(bounds.max.y - bounds.min.y, 0.001);
    const fittedScale = (transform.targetHeight / height) * transform.scale;
    visual.scaling.set(
      fittedScale * transform.scaleX,
      fittedScale * transform.scaleY,
      fittedScale * transform.scaleZ
    );
    visual.rotation.set(transform.rotationX, transform.rotationY, transform.rotationZ);
    visual.position.set(
      transform.offsetX,
      -bounds.min.y * fittedScale + transform.offsetY,
      transform.offsetZ
    );
    applyAvatarAppearance(result.meshes, transform);

    const idle = findAnimationGroupByName(result.animationGroups, "Idle") || findAnimationGroup(result.animationGroups, /idle/i);
    const walk = findAnimationGroupByName(result.animationGroups, "Walk") || findAnimationGroup(result.animationGroups, /walk/i);
    const run = findAnimationGroupByName(result.animationGroups, "Run") || findAnimationGroup(result.animationGroups, /run/i);

    worldState.localAvatarRoot = root;
    worldState.localAvatarAnimations = { idle, walk, run };
    worldState.localAvatarActiveAnimation = null;
    worldState.localAvatarLastAngle = null;
    worldState.localAvatarTurnLean = 0;
    updateAvatarAnimation({ isMoving: false, isSprinting: false });
  })().catch((error) => {
    console.warn("Failed to load local avatar:", error);
    worldState.localAvatarLoadPromise = null;
  });

  return worldState.localAvatarLoadPromise;
}

function updateAvatarAnimation({ isMoving, isSprinting }) {
  const anims = worldState.localAvatarAnimations;
  if (!anims) return;

  const { idle, walk, run } = anims;
  const nextAnimation = !isMoving ? "idle" : (isSprinting && run ? "run" : "walk");
  if (worldState.localAvatarActiveAnimation === nextAnimation) return;
  worldState.localAvatarActiveAnimation = nextAnimation;

  for (const group of [idle, walk, run]) {
    if (group) {
      group.stop();
      group.reset();
    }
  }

  const activeGroup = !isMoving ? idle : (isSprinting && run ? run : walk);
  if (activeGroup) {
    activeGroup.reset();
    activeGroup.start(true);
  }
}

function syncLocalAvatar(gameState) {
  const root = worldState.localAvatarRoot;
  const { player, z, isMoving, isSprinting, isShiftLock, moveFacingAngle } = gameState;
  if (!root || !player) return;

  root.position.x = player.x;
  root.position.y = z || 0;
  root.position.z = player.y;
  const currentVisualAngle = Number.isFinite(worldState.localAvatarVisualAngle)
    ? worldState.localAvatarVisualAngle
    : player.angle;
  const targetFacingAngle = (!isShiftLock && isMoving && Number.isFinite(moveFacingAngle))
    ? moveFacingAngle
    : player.angle;
  const facingDelta = normalizeAngle(targetFacingAngle - currentVisualAngle);
  const nextVisualAngle = currentVisualAngle + facingDelta * 0.28;
  worldState.localAvatarVisualAngle = nextVisualAngle;
  root.rotation.y = Math.PI / 2 - nextVisualAngle;
  const previousAngle = Number.isFinite(worldState.localAvatarLastAngle) ? worldState.localAvatarLastAngle : player.angle;
  const angleDelta = normalizeAngle(player.angle - previousAngle);
  worldState.localAvatarLastAngle = player.angle;

  const targetLean = clamp(angleDelta * 5.5, -0.22, 0.22);
  worldState.localAvatarTurnLean = lerp(worldState.localAvatarTurnLean, targetLean, 0.2);
  root.rotation.z = worldState.localAvatarTurnLean;
  root.rotation.x = 0;

  updateAvatarAnimation({ isMoving: Boolean(isMoving), isSprinting: Boolean(isSprinting) });
}

/**
 * Synchronizes the Babylon camera with game state (cameraYaw, pitch, player position).
 * Uses pure 3D rotation-based camera orientation driven by cameraYaw (horizontal look)
 * and pitch (vertical look). This is the authoritative 3D camera sync—no 2.5D logic here.
 * 
 * The camera is positioned behind the player in follow-cam style, oriented by rotation
 * angles that come directly from player input (mouse/keyboard camera controls).
 */
function syncBabylonCamera(gameState) {
  const camera = worldState.camera;
  const { player, z, pitch, cameraYaw } = gameState;
  if (!camera || !player) return;

  const followDistance = 4.25;
  const followHeight = 2.2;
  const eyeY = 0.5 + (z || 0);
  // Use cameraYaw as primary view direction; fall back to player.angle if undefined
  const viewYaw = Number.isFinite(cameraYaw) ? cameraYaw : player.angle;
  const clampedPitch = clamp(Number.isFinite(pitch) ? pitch : 0, -1.25, 1.25);

  // Apply pure 3D rotation: yaw (horizontal) and pitch (vertical)
  camera.rotation.y = viewYaw + Math.PI / 2;  // Babylon convention: +Math.PI/2 for north-facing baseline
  camera.rotation.x = clampedPitch;           // Pitch: positive = look down, negative = look up
  camera.rotation.z = 0;                      // No roll

  // Position camera behind player in world space, offset along the camera's backward direction
  const followX = Math.cos(viewYaw);
  const followZ = -Math.sin(viewYaw);
  camera.position.set(
    player.x - followX * followDistance,
    eyeY + followHeight,
    player.y - followZ * followDistance
  );
}

function syncRemoteAvatars(scene, gameState) {
  const { others, myId } = gameState;
  const activeIds = new Set();

  for (const id in others || {}) {
    if (id === myId) continue;
    activeIds.add(id);
    const p = others[id];
    let mesh = worldState.remoteAvatarMeshes.get(id);
    if (!mesh) {
      mesh = MeshBuilder.CreateCapsule(`remoteAvatar-${id}`, {
        height: 1.8,
        radius: 0.28,
        tessellation: 8,
      }, scene);
      mesh.isPickable = false;
      mesh.material = createMaterial(scene, `remoteAvatarMat-${id}`, new Color3(0.72, 0.84, 1.0), 1);
      worldState.remoteAvatarMeshes.set(id, mesh);
    }

    mesh.position.set(p.x, (p.z || 0) + 0.9, p.y);
    mesh.rotation.y = Math.PI / 2 - (p.angle || 0);
    mesh.visibility = p.isDead ? 0.35 : 1;
    mesh.material.alpha = p.sneaking ? 0.55 : 1;
  }

  for (const [id, mesh] of worldState.remoteAvatarMeshes.entries()) {
    if (activeIds.has(id)) continue;
    mesh.dispose();
    worldState.remoteAvatarMeshes.delete(id);
  }
}

function buildStaticWorld(scene) {
  if (worldState.worldRoot) {
    worldState.worldRoot.dispose(false, true);
    worldState.worldRoot = null;
  }

  const root = new TransformNode("worldRoot", scene);
  worldState.worldRoot = root;

  const mapWidth = Math.max(...map.map((row) => row.length));
  const mapHeight = map.length;

  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: mapWidth + 20, height: mapHeight + 20 },
    scene
  );
  ground.parent = root;
  ground.position.y = 0;
  ground.material = createMaterial(scene, "groundMat", new Color3(0.34, 0.34, 0.35), 1);

  const wallMaterial = createMaterial(scene, "wallMat", new Color3(0.95, 0.95, 0.95), 1);
  const falseWallMaterial = createMaterial(scene, "falseWallMat", new Color3(0.72, 0.74, 0.76), 0.55);
  const diagonalMaterial = createMaterial(scene, "diagonalMat", new Color3(0.92, 0.92, 0.92), 1);
  const pillarMaterial = createMaterial(scene, "pillarMat", new Color3(0.98, 0.98, 0.98), 1);

  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    for (let x = 0; x < row.length; x++) {
      const char = row[x];
      const geo = getGeometry(char);
      if (!geo || !geo.render) continue;

      const centerX = x + 0.5;
      const centerZ = y + 0.5;

      if (geo.type === "full") {
        const wall = MeshBuilder.CreateBox(`wall-${x}-${y}`, { width: 1, height: 1, depth: 1 }, scene);
        wall.parent = root;
        wall.position.set(centerX, 0.5, centerZ);
        wall.material = geo.solid ? wallMaterial : falseWallMaterial;
        continue;
      }

      if (geo.type === "pillar") {
        const pillar = MeshBuilder.CreateCylinder(
          `pillar-${x}-${y}`,
          { diameter: (geo.radius ?? 0.15) * 2.2, height: 1, tessellation: 20 },
          scene
        );
        pillar.parent = root;
        pillar.position.set(centerX, 0.5, centerZ);
        pillar.material = pillarMaterial;
        continue;
      }

      if (geo.type === "diagonal") {
        const diagonal = MeshBuilder.CreateBox(
          `diagonal-${x}-${y}`,
          { width: 1.3, height: 1, depth: 0.12 },
          scene
        );
        diagonal.parent = root;
        diagonal.position.set(centerX, 0.5, centerZ);
        diagonal.rotation.y = geo.slope === 1 ? Math.PI / 4 : -Math.PI / 4;
        diagonal.material = diagonalMaterial;
      }
    }
  }
}

async function getCadModelUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("mapModel");
  if (fromQuery) return fromQuery;

  for (const candidate of DEFAULT_CAD_MAP_URLS) {
    if (await canFetchModel(candidate)) {
      return candidate;
    }
  }

  return DEFAULT_CAD_MAP_URLS[0];
}

function splitModelUrl(url) {
  const clean = String(url || "").trim();
  if (!clean) return { rootUrl: "", fileName: "" };

  if (/^https?:\/\//i.test(clean)) {
    const u = new URL(clean);
    const slash = u.pathname.lastIndexOf("/");
    const basePath = slash >= 0 ? u.pathname.slice(0, slash + 1) : "/";
    return {
      rootUrl: `${u.origin}${basePath}`,
      fileName: u.pathname.slice(slash + 1) + (u.search || "") + (u.hash || ""),
    };
  }

  const slash = clean.lastIndexOf("/");
  if (slash === -1) return { rootUrl: "./", fileName: clean };
  return {
    rootUrl: clean.slice(0, slash + 1),
    fileName: clean.slice(slash + 1),
  };
}

async function canFetchModel(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
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

async function loadCadTransform() {
  if (worldState.cadTransform) return worldState.cadTransform;
  try {
    const response = await fetch(CAD_TRANSFORM_URL);
    if (!response.ok) {
      worldState.cadTransform = { ...DEFAULT_CAD_MODEL_TRANSFORM };
      return worldState.cadTransform;
    }
    const json = await response.json();
    worldState.cadTransform = normalizeCadTransform(json);
  } catch {
    worldState.cadTransform = { ...DEFAULT_CAD_MODEL_TRANSFORM };
  }
  return worldState.cadTransform;
}

async function buildCadWorld(scene, modelUrl, transform) {
  const exists = await canFetchModel(modelUrl);
  if (!exists) return false;

  if (worldState.worldRoot) {
    worldState.worldRoot.dispose(false, true);
    worldState.worldRoot = null;
  }

  const root = new TransformNode("cadWorldRoot", scene);
  worldState.worldRoot = root;

  const { rootUrl, fileName } = splitModelUrl(modelUrl);
  if (!fileName) return false;

  const result = await SceneLoader.ImportMeshAsync("", rootUrl, fileName, scene);
  const imported = result.meshes || [];

  for (const mesh of imported) {
    if (mesh === root) continue;
    if (!mesh.parent) mesh.parent = root;
    if (mesh.name === "__root__") continue;
    mesh.isPickable = false;
  }

  const bounds = root.getHierarchyBoundingVectors(true);
  const centerX = (bounds.min.x + bounds.max.x) * 0.5;
  const centerY = (bounds.min.y + bounds.max.y) * 0.5;
  const minZ = bounds.min.z;

  root.rotation.set(transform.rotationX, transform.rotationY, transform.rotationZ);
  root.scaling.setAll(transform.scale);
  root.position.set(
    -centerX * transform.scale + transform.offsetX,
    -minZ * transform.scale + transform.offsetY,
    -centerY * transform.scale + transform.offsetZ
  );

  worldState.cadLoaded = true;
  worldState.cadModelUrl = modelUrl;
  return true;
}

function scheduleCadWorldLoad(scene) {
  if (worldState.cadLoadPromise) return;
  worldState.cadLoadPromise = (async () => {
    const transform = await loadCadTransform();
    const modelUrl = await getCadModelUrl();
    worldState.cadChecked = true;
    try {
      const loaded = await buildCadWorld(scene, modelUrl, transform);
      if (!loaded) {
        worldState.cadLoaded = false;
      }
    } catch (error) {
      console.warn("CAD map load failed, falling back to tile map:", error);
      worldState.cadLoaded = false;
      if (!worldState.worldRoot) buildStaticWorld(scene);
    }
  })();
}

function ensureBabylon(canvas) {
  if (worldState.engine) return worldState;

  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.2, 0.2, 0.24, 1);
  scene.ambientColor = new Color3(1, 1, 1);

  const camera = new FreeCamera("gameCamera", new Vector3(0, 1, 0), scene);
  camera.minZ = 0.05;
  camera.fov = FOV;
  camera.upVector = new Vector3(0, 1, 0);

  const light = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
  light.intensity = 1.0;

  worldState.engine = engine;
  worldState.scene = scene;
  worldState.camera = camera;
  worldState.mapRef = map;

  buildStaticWorld(scene);
  scheduleCadWorldLoad(scene);
  loadLocalAvatar(scene);

  if (!worldState.resizeHandler) {
    worldState.resizeHandler = () => engine.resize();
    window.addEventListener("resize", worldState.resizeHandler);
  }

  return worldState;
}

function syncCamera(gameState) {
  const camera = worldState.camera;
  if (!camera) return;

  camera.fov = FOV;
  syncLocalAvatar(gameState);
  syncBabylonCamera(gameState);
}

export function renderBabylonWorld(canvas, gameState) {
  const state = ensureBabylon(canvas);
  if (!state.cadLoaded && state.mapRef !== map) {
    state.mapRef = map;
    buildStaticWorld(state.scene);
  }

  syncCamera(gameState);
  syncRemoteAvatars(state.scene, gameState);
  state.scene.render();
}

export function disposeBabylonWorld() {
  if (worldState.worldRoot) {
    worldState.worldRoot.dispose(false, true);
    worldState.worldRoot = null;
  }
  if (worldState.scene) {
    worldState.scene.dispose();
    worldState.scene = null;
  }
  if (worldState.engine) {
    worldState.engine.dispose();
    worldState.engine = null;
  }
  worldState.camera = null;
  worldState.mapRef = null;
  worldState.localAvatarRoot = null;
  worldState.localAvatarAnimations = null;
  worldState.localAvatarLoadPromise = null;
  worldState.localAvatarActiveAnimation = null;
  worldState.localAvatarLastAngle = null;
  worldState.localAvatarVisualAngle = null;
  worldState.localAvatarTurnLean = 0;
  for (const mesh of worldState.remoteAvatarMeshes.values()) {
    mesh.dispose();
  }
  worldState.remoteAvatarMeshes.clear();
}
