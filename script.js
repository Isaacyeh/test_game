const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

/* =======================
   CONSTANTS
======================= */
const PLAYER_RADIUS = 0.2;
const MOVE_SPEED = 0.05;

const FOV = Math.PI / 3;
const RAYS = canvas.width;

const MINIMAP_SCALE = 10;
const MINIMAP_PADDING = 10;

/* =======================
   MAP
======================= */
const map = [
  "1111111111",
  "1000000001",
  "1001000001",
  "1000000001",
  "1111111111",
];
/*
new map prototype

const map = [
  "1111111111",
  "1000000001",
  "1001000001",
  "1000000001",
  "1111111111",
];
*/

function isWall(x, y) {
  return map[Math.floor(y)]?.[Math.floor(x)] === "1";
}

/* =======================
   PLAYER STATE
======================= */
let player = { x: 2, y: 2, angle: 0 };
let others = {};
let myId = null;

/* =======================
   WEBSOCKET
======================= */
const wsProtocol = location.protocol === "https:" ? "wss://" : "ws://";
const ws = new WebSocket(wsProtocol + location.host);

ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.id) myId = data.id;
  else others = data;
};

/* =======================
   INPUT
======================= */
const keys = {};
onkeydown = (e) => (keys[e.key] = true);
onkeyup = (e) => (keys[e.key] = false);

/* =======================
   RAYCASTING
======================= */
function castRay(angle) {
  for (let d = 0; d < 20; d += 0.02) {
    const x = player.x + Math.cos(angle) * d;
    const y = player.y + Math.sin(angle) * d;
    if (isWall(x, y)) return d;
  }
  return 20;
}

/* =======================
   MINIMAP
======================= */
function drawMinimap() {
  const mapWidth = map[0].length * MINIMAP_SCALE;
  const mapHeight = map.length * MINIMAP_SCALE;

  const startX = MINIMAP_PADDING;
  const startY = MINIMAP_PADDING;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(startX - 4, startY - 4, mapWidth + 8, mapHeight + 8);

  // Walls
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === "1") {
        ctx.fillStyle = "#888";
        ctx.fillRect(
          startX + x * MINIMAP_SCALE,
          startY + y * MINIMAP_SCALE,
          MINIMAP_SCALE,
          MINIMAP_SCALE
        );
      }
    }
  }

  // Other players
  for (const id in others) {
    if (id === myId) continue;
    const p = others[id];

    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(
      startX + p.x * MINIMAP_SCALE,
      startY + p.y * MINIMAP_SCALE,
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
    startX + player.x * MINIMAP_SCALE,
    startY + player.y * MINIMAP_SCALE,
    4,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Direction
  ctx.strokeStyle = "lime";
  ctx.beginPath();
  ctx.moveTo(
    startX + player.x * MINIMAP_SCALE,
    startY + player.y * MINIMAP_SCALE
  );
  ctx.lineTo(
    startX + (player.x + Math.cos(player.angle) * 0.7) * MINIMAP_SCALE,
    startY + (player.y + Math.sin(player.angle) * 0.7) * MINIMAP_SCALE
  );
  ctx.stroke();
}

/* =======================
   UPDATE (MOVEMENT + COLLISION)
======================= */
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

  // X collision
  const nextX = player.x + moveX;
  if (
    !isWall(nextX + PLAYER_RADIUS, player.y) &&
    !isWall(nextX - PLAYER_RADIUS, player.y)
  ) {
    player.x = nextX;
  }

  // Y collision
  const nextY = player.y + moveY;
  if (
    !isWall(player.x, nextY + PLAYER_RADIUS) &&
    !isWall(player.x, nextY - PLAYER_RADIUS)
  ) {
    player.y = nextY;
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(player));
  }
}

/* =======================
   RENDER
======================= */
function render() {
  // Sky
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);

  // Floor
  ctx.fillStyle = "#555";
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

  const depthBuffer = [];

  // Walls
  for (let i = 0; i < RAYS; i++) {
    const rayAngle = player.angle - FOV / 2 + (i / RAYS) * FOV;
    const dist = castRay(rayAngle) * Math.cos(rayAngle - player.angle);
    const height = canvas.height / dist;

    depthBuffer[i] = dist;

    ctx.fillStyle = "#ddd";
    ctx.fillRect(i, (canvas.height - height) / 2, 1, height);
  }

  // Player sprites
  for (const id in others) {
    if (id === myId) continue;
    const p = others[id];

    const dx = p.x - player.x;
    const dy = p.y - player.y;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const angleTo = Math.atan2(dy, dx) - player.angle;
    const angle = Math.atan2(Math.sin(angleTo), Math.cos(angleTo));

    if (Math.abs(angle) > FOV / 2) continue;

    const screenX = (0.5 + angle / FOV) * canvas.width;
    const size = canvas.height / distance;

    const column = Math.floor(screenX);
    if (column < 0 || column >= depthBuffer.length) continue;
    if (depthBuffer[column] < distance) continue;

    ctx.fillStyle = "red";
    ctx.fillRect(
      screenX - size / 4,
      (canvas.height - size) / 2,
      size / 2,
      size
    );
  }

  drawMinimap();
  requestAnimationFrame(loop);
}

/* =======================
   MAIN LOOP
======================= */
function loop() {
  update();
  render();
}

loop();
