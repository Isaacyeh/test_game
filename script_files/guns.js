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
