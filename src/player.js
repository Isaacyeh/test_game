// player.js
// contains the local player's state and information about other players

export const player = { x: 3, y: 17, angle: 0, z: 0, zVel: 0, onGround: true };

// network-updated state
export const others = {};
export let myId = null;
export let username = "Anonymous";

export function setUsername(name) {
  username = name.trim() || "Anonymous";
}

// convenience setter used by network module
export function setMyId(id) {
  myId = id;
}
