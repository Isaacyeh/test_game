const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

/* =====================
   CONSTANTS
===================== */
const PLAYER_RADIUS = 0.2;
const MOVE_SPEED = 0.05;

const FOV = Math.PI / 3;
const RAYS = canvas.width;

const JUMP_VELOCITY = 0.22;
const GRAVITY = 0.012;
const MAX_JUMP = 0.35; // clamp jump height
const JUMP_SCALE = 200; // pixels per height unit

const MINIMAP_SCALE = 10;
const MINIMAP_PADDING = 10;

/* =====================
   MAP
===================== */
const maps = [
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
    "---------#---######----------------------#----------#-----##---------",
    "---------#---#---###-######--------------#----------#-----#----------",
    "---------#---#---#----##--#--------------#----------#-----#########--",
    "---------#---#---#-----#--#############-##----------##------------##-",
    "---------#--##---#-----#------------#----#-----------#-------------##",
    "---------#--##--###-####------------#----#-----------#--------------#",
    "---------#---#--#-----#########-----##--##-----------#-------########",
    "---------#---####--------#----#------#-###############-------#-------",
    "---------#--------------------#-----##-----------------------#-------",
    "---------#---#-----------#----#-----#-----------##############-------",
    "---------#####--#-----#--#---##-----#-----------#--------------------",
    "-------------#--#-----#--#---#------#-----------#--------------------",
    "-------------#--#######--#---########-----------#--------------------",
    "-------------#-----------#----------#---####----#--------------------",
    "-------------##----------#--------------####----#--------------------",
    "-------------#-----##----########################--------------------",
    "-------------#----#------#-------------------------------------------",
    "-------------#-----------#-------------------------------------------",
    "-------------###-#####-###-------------------------------------------",
    "--------------#---------#--------------------------------------------",
    "--------------#---------#--------------------------------------------",
    "--------------###########--------------------------------------------",
  ],
  [
    "1111111111",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1--------1",
    "1111111111",
  ],
];

let mapIndex = 0;
let map = maps[mapIndex];
const mapStr = "#";

function isWall(x, y) {
  return map[Math.floor(y)]?.[Math.floor(x)] === mapStr;
}

/* =====================
   PLAYER STATE
===================== */
let player = { x: 3, y: 17, angle: 0 };
let z = 0;
let zVel = 0;
let onGround = true;

let others = {};
let myId = null;

/* =====================
   WEBSOCKET
===================== */
const wsProtocol = location.protocol === "https:" ? "wss://" : "ws://";
const ws = new WebSocket(wsProtocol + location.host);

ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.id) myId = data.id;
  else others = data;
};

/* =====================
   INPUT
===================== */
const keys = {};
onkeydown = (e) => (keys[e.key] = true);
onkeyup = (e) => (keys[e.key] = false);

/* =====================
   RAYCASTING
===================== */
function castRay(angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  let d = 0;
  let prevX = player.x;
  let prevY = player.y;

  while (d < 20) {
    const x = player.x + cos * d;
    const y = player.y + sin * d;

    if (isWall(x, y)) {
      const hitVertical = Math.floor(x) !== Math.floor(prevX);
      return { dist: d, vertical: hitVertical };
    }

    prevX = x;
    prevY = y;
    d += 0.02;
  }

  return { dist: 20, vertical: false };
}

/* =====================
   MINIMAP
===================== */
function drawMinimap() {
  const VIEW_RADIUS = 12;
  const startX = MINIMAP_PADDING;
  const startY = MINIMAP_PADDING;
  const size = VIEW_RADIUS * 2;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(startX - 4, startY - 4, size * MINIMAP_SCALE + 8, size * MINIMAP_SCALE + 8);

  const centerX = Math.floor(player.x);
  const centerY = Math.floor(player.y);

  for (let y = -VIEW_RADIUS; y < VIEW_RADIUS; y++) {
    for (let x = -VIEW_RADIUS; x < VIEW_RADIUS; x++) {
      const mapX = centerX + x;
      const mapY = centerY + y;

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

  // Draw other players
  for (const id in others) {
    if (id === myId) continue;
    const p = others[id];

    const dx = p.x - player.x;
    const dy = p.y - player.y;

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

  // Player
  ctx.fillStyle = "lime";
  ctx.beginPath();
  ctx.arc(
    startX + VIEW_RADIUS * MINIMAP_SCALE + (VIEW_RADIUS / 2),
    startY + VIEW_RADIUS * MINIMAP_SCALE + (VIEW_RADIUS / 2),
    4,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Direction
  ctx.strokeStyle = "lime";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(
    startX + VIEW_RADIUS * MINIMAP_SCALE + (VIEW_RADIUS / 2),
    startY + VIEW_RADIUS * MINIMAP_SCALE + (VIEW_RADIUS / 2)
  );
  ctx.lineTo(
    startX + (VIEW_RADIUS + Math.cos(player.angle) * 0.8) * MINIMAP_SCALE + (VIEW_RADIUS / 2),
    startY + (VIEW_RADIUS + Math.sin(player.angle) * 0.8) * MINIMAP_SCALE + (VIEW_RADIUS / 2)
  );
  ctx.stroke();
}

/* =====================
   UPDATE
===================== */
function update() {
  if (keys["ArrowLeft"]) player.angle -= 0.04;
  if (keys["ArrowRight"]) player.angle += 0.04;

  let moveX = 0;
  let moveY = 0;

  if (keys["w"]) {
    moveX += Math.cos(player.angle) * MOVE_SPEED;
    moveY += Math.sin(player.angle) * MOVE_SPEED;
  }
  if (keys["s"]) {
    moveX -= Math.cos(player.angle) * MOVE_SPEED;
    moveY -= Math.sin(player.angle) * MOVE_SPEED;
  }
  if (keys["a"]) {
    moveX += Math.cos(player.angle - Math.PI / 2) * MOVE_SPEED;
    moveY += Math.sin(player.angle - Math.PI / 2) * MOVE_SPEED;
  }
  if (keys["d"]) {
    moveX += Math.cos(player.angle + Math.PI / 2) * MOVE_SPEED;
    moveY += Math.sin(player.angle + Math.PI / 2) * MOVE_SPEED;
  }

  const nx = player.x + moveX;
  if (!isWall(nx + PLAYER_RADIUS, player.y) && !isWall(nx - PLAYER_RADIUS, player.y)) {
    player.x = nx;
  }

  const ny = player.y + moveY;
  if (!isWall(player.x, ny + PLAYER_RADIUS) && !isWall(player.x, ny - PLAYER_RADIUS)) {
    player.y = ny;
  }

  if (keys[" "] && onGround) {
    zVel = JUMP_VELOCITY;
    onGround = false;
  }

  zVel -= GRAVITY;
  z += zVel;
  z = Math.min(z, MAX_JUMP);

  if (z <= 0) {
    z = 0;
    zVel = 0;
    onGround = true;
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        x: player.x,
        y: player.y,
        angle: player.angle,
        z,
      })
    );
  }
}

/* =====================
   RENDER
===================== */
function render() {
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
    const hit = castRay(rayAngle);
    const dist = hit.dist * Math.cos(rayAngle - player.angle);
    const height = canvas.height / dist;

    depth[i] = dist;

    // Determine wall face color
    const faceColor = "#ffffff";    // main face color
    const edgeColor = "#000000";    // edge color

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

  drawMinimap();
  requestAnimationFrame(loop);
}

/* =====================
   LOOP
===================== */
function loop() {
  update();
  render();
}

loop();
