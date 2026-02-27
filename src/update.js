// update.js
// game-state update logic (movement, physics, networking)

import { keys, isChatting } from "./input.js";
import { player } from "./player.js";
import { MOVE_SPEED, JUMP_VELOCITY, GRAVITY, MAX_JUMP, JUMP_SCALE, PLAYER_RADIUS } from "./constants.js";
import { isWall } from "./map.js";
import { ws, sendPlayerState } from "./network.js";

// NOTE: we cannot reassign imported primitives, so we will export functions
// that mutate the state directly. We'll restructure the player module if needed.

export function updateState() {
  if (isChatting) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendPlayerState({ x: player.x, y: player.y, angle: player.angle, z: player.z });
    }
    return;
  }

  if (keys["ArrowLeft"]) player.angle -= 0.04;
  if (keys["ArrowRight"]) player.angle += 0.04;

  let moveX = 0,
    moveY = 0;

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

  if (keys[" "] && player.onGround) {
    player.zVel = JUMP_VELOCITY;
    player.onGround = false;
  }

  const nx = player.x + moveX;
  if (
    !isWall(nx + PLAYER_RADIUS, player.y) &&
    !isWall(nx - PLAYER_RADIUS, player.y)
  )
    player.x = nx;

  const ny = player.y + moveY;
  if (
    !isWall(player.x, ny + PLAYER_RADIUS) &&
    !isWall(player.x, ny - PLAYER_RADIUS)
  )
    player.y = ny;

  player.zVel -= GRAVITY;
  player.z += player.zVel;
  player.z = Math.min(player.z, MAX_JUMP);

  if (player.z <= 0) {
    player.z = 0;
    player.zVel = 0;
    player.onGround = true;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    sendPlayerState({ x: player.x, y: player.y, angle: player.angle, z: player.z });
  }
}
