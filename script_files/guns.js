import {PLAYER_RADIUS} from "./constant.js";

//projectile constants
export const PROJECTILE_SPEED = 2;          // Visual tracer speed (world units/frame)
export const PROJECTILE_LIFETIME = 60;         // Tracer lives 60 frames max (it dies at wall/range)
export const PROJECTILE_START_Z = 0.0;
export const PROJECTILE_RADIUS = 0.0125;        // Visual only — hit detection is ray-based
export const TRACER_MAX_RANGE = 18;   
export const SHOOT_COOLDOWN = 10;  // Cooldown between shots in frames

export const HIT_DAMAGE = 10;

// Ray-based hit detection radius (used server-side too)
export const PROJECTILE_HIT_RADIUS = PLAYER_RADIUS + PROJECTILE_RADIUS; // 0.225
export const PROJECTILE_HIT_RADIUS_Z = PLAYER_RADIUS + PROJECTILE_RADIUS; // 0.225

// script_files/guns.js
export const GUNS = {
  rifle: {
    name: "Rifle",
    damage: 0.1,
    projectileSpeed: 2,
    range: 18,
    cooldown: 10,
    projectileRadius: 0.0125,
  },
  shotgun: {
    name: "Shotgun",
    damage: 0.15,
    projectileSpeed: 3,
    range: 12,
    cooldown: 20,
    projectileRadius: 0.05,
  },
  sniper: {
    name: "Sniper",
    damage: 0.3,
    projectileSpeed: 4,
    range: 25,
    cooldown: 30,
    projectileRadius: 0.005,
  },
  pistol: {
    name: "Pistol",
    damage: 0.08,
    projectileSpeed: 2.5,
    range: 15,
    cooldown: 8,
    projectileRadius: 0.01,
  },
  penis: {
    name: "penis",
    damage: 1,
    projectileSpeed: 4,
    range: 25,
    cooldown: 30,
    projectileRadius: 0.01,
  },
};

export function getGun(gunType) {
  return GUNS[gunType] || GUNS.rifle;
}
