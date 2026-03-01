import { PLAYER_RADIUS, MOVE_SPEED, JUMP_VELOCITY, GRAVITY, MAX_JUMP } from "./constant.js";
import { isWall } from "./map.js";

const state = {
  player: { x: 3, y: 17, angle: 0 },
  z: 0,
  zVel: 0,
  onGround: true,
  isChatting: false,
  others: {},
  myId: null,
  username:
    (prompt("Enter your username:") || "Anonymous").trim() || "Anonymous",
};

let keysRef = null;
let wsRef = null;

// init
export function initPlayer(keys, ws) {
  keysRef = keys;
  wsRef = ws;
}
export function setIsChatting(value) { state.isChatting = value; }
export function setMyId(id) { state.myId = id; }
export function setOthers(nextOthers) { state.others = { ...nextOthers }; }
export function getState() { return state; }

function canMove(x, y) {
  return (
    !isWall(x + PLAYER_RADIUS, y + PLAYER_RADIUS) &&
    !isWall(x - PLAYER_RADIUS, y + PLAYER_RADIUS) &&
    !isWall(x + PLAYER_RADIUS, y - PLAYER_RADIUS) &&
    !isWall(x - PLAYER_RADIUS, y - PLAYER_RADIUS)
  );
}

//update loop
export function update() {
  if (!keysRef || !wsRef) return;
  const { player } = state;

  if (state.isChatting) {
    if (wsRef.readyState === WebSocket.OPEN) {
      wsRef.send(
        JSON.stringify({
          x: player.x,
          y: player.y,
          angle: player.angle,
          z: state.z,
        })
      );
    }
    return;
  }

  //movement / controls
  if (keysRef.ArrowLeft) player.angle -= 0.04;
  if (keysRef.ArrowRight) player.angle += 0.04;

  let moveX = 0;
  let moveY = 0;

  if (keysRef.w) {
    moveX += Math.cos(player.angle) * MOVE_SPEED;
    moveY += Math.sin(player.angle) * MOVE_SPEED;
  }
  if (keysRef.s) {
    moveX -= Math.cos(player.angle) * MOVE_SPEED;
    moveY -= Math.sin(player.angle) * MOVE_SPEED;
  }
  if (keysRef.a) {
    moveX += Math.cos(player.angle - Math.PI / 2) * MOVE_SPEED;
    moveY += Math.sin(player.angle - Math.PI / 2) * MOVE_SPEED;
  }
  if (keysRef.d) {
    moveX += Math.cos(player.angle + Math.PI / 2) * MOVE_SPEED;
    moveY += Math.sin(player.angle + Math.PI / 2) * MOVE_SPEED;
  }

  //collision
  const nx = player.x + moveX;
  const ny = player.y + moveY;

  if (canMove(nx, ny)) {
    player.x = nx;
    player.y = ny;
  } else {
    // X 
    if (canMove(nx, player.y)) {
      player.x = nx;
    }
    // Y 
    if (canMove(player.x, ny)) {
      player.y = ny;
    }
  }

  //jump
  if (keysRef[" "] && state.onGround) {
    state.zVel = JUMP_VELOCITY;
    state.onGround = false;
  }

  state.zVel -= GRAVITY;
  state.z += state.zVel;
  state.z = Math.min(state.z, MAX_JUMP);

  if (state.z <= 0) {
    state.z = 0;
    state.zVel = 0;
    state.onGround = true;
  }

  if (wsRef.readyState === WebSocket.OPEN) {
    wsRef.send( JSON.stringify({ x: player.x, y: player.y, angle: player.angle, z: state.z }));
  }
}
