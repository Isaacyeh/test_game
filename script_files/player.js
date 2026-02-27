import {
  PLAYER_RADIUS,
  MOVE_SPEED,
  JUMP_VELOCITY,
  GRAVITY,
  MAX_JUMP,
} from "./script_files/constants.js";

//player state
export let player = { x: 3, y: 17, angle: 0 };
export let z = 0;
export let zVel = 0;
export let onGround = true;
export let isChatting = false;

//server side states
export let others = {};
export let myId = null;
export let username = prompt("Enter your username:") || "Anonymous";
username = username.trim() || "Anonymous";

//update loop
export function update() {
  //disable movement while chatting
  if (isChatting) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({ x: player.x, y: player.y, angle: player.angle, z })
      );
    }
    return;
  }
  //arrow keys turn camera
  if (keys["ArrowLeft"]) player.angle -= 0.04;
  if (keys["ArrowRight"]) player.angle += 0.04;

  let moveX = 0,
    moveY = 0;
  //wasd moves character
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
  //jump
  if (keys[" "] && onGround) {
    zVel = JUMP_VELOCITY;
    onGround = false;
  }
  //x-collision
  const nx = player.x + moveX;
  if (
    !isWall(nx + PLAYER_RADIUS, player.y) &&
    !isWall(nx - PLAYER_RADIUS, player.y)
  )
    player.x = nx;
  //y-collision
  const ny = player.y + moveY;
  if (
    !isWall(player.x, ny + PLAYER_RADIUS) &&
    !isWall(player.x, ny - PLAYER_RADIUS)
  )
    player.y = ny;
  //gravity (z)
  zVel -= GRAVITY;
  z += zVel;
  z = Math.min(z, MAX_JUMP);

  if (z <= 0) {
    z = 0;
    zVel = 0;
    onGround = true;
  }
  //send info
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({ x: player.x, y: player.y, angle: player.angle, z })
    );
  }
}
