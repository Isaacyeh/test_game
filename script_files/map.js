export const maps = [
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
    "#------------#--#-----#--#---#------#-----------#-----##------------#",
    "#------------#--#######--#---########----------------#--#-----------#",
    "#------------#-----------#----------#---####----#----#--------------#",
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
    "############################",
    "#------|-----------------#",
    "#-------#----------------#",
    "#------/-----------------#",
    "############################",
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
//  "F"  False wall         — looks like "#" but player walks straight through
//  "S"  Floor slab         — half-height wall on the floor, half hitbox
//  "C"  Ceiling slab       — half-height wall on ceiling, player walks under
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
  "S":  { type: "slab",     solid: true,  render: true,  heightScale: 0.5, yOffset:  0.0 },
  "C":  { type: "slab",     solid: false, render: true,  heightScale: 0.5, yOffset: -0.5 }, // walk under
  "D":  { type: "door",     solid: true,  render: true,  axis: "x", openAmount: 0 },
  "Z":  { type: "door",     solid: true,  render: true,  axis: "y", openAmount: 0 },
  "/":  { type: "diagonal", solid: true,  render: true,  slope:  1 },
  "|": { type: "diagonal", solid: true,  render: true,  slope: -1 },
  "T":  { type: "thin",     solid: true,  render: true,  planeOffset: 0.45, thickness: 0.1 },
  "P":  { type: "pillar",   solid: true,  render: true,  radius: 0.15 },
};

export function getGeometry(char) {
  return GEOMETRY[char] ?? null;
}

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

// ── Per-geometry collision ────────────────────────────────────────────────────
// Tests whether the point (px, py) is inside the solid region of the geometry
// at tile (tileX, tileY). Each type matches its visual shape exactly.

function collidesWithGeometry(geo, px, py, tileX, tileY) {
  // Local coords within the tile (0..1)
  const lx = px - tileX;
  const ly = py - tileY;

  switch (geo.type) {

    case "full":
      // Only solid if the geo says so (false walls return false here)
      return geo.solid;

    case "slab": {
      // Floor slab: solid in the bottom half of the tile (ly < 0.5 in world means
      // the player is overlapping the slab's footprint — slabs block XY movement
      // but not vertical, so we just treat it as a full-tile XY blocker since
      // the player can't jump over walls in this engine).
      // Set solid:false on "C" ceiling slab so player walks under it.
      return geo.solid;
    }

    case "door": {
      const open = geo.openAmount ?? 0;
      if (open >= 0.9) return false; // fully open — walk through
      // The door panel spans the cell; the open gap is [0, open] on the non-axis side.
      // Collision: player is in the closed portion of the door.
      if (geo.axis === "x") {
        // Panel runs along X; gap opens from lx=0 upward
        return lx > open;
      } else {
        return ly > open;
      }
    }

    case "diagonal": {
      // slope = 1:  line from (0,1)→(1,0), equation: lx + ly = 1
      //   solid on the side where lx + ly > 1
      // slope = -1: line from (0,0)→(1,1), equation: lx - ly = 0
      //   solid on the side where lx - ly < 0  (i.e. ly > lx)
      const MARGIN = 0.08; // thickness of the collidable band around the line
      if (geo.slope === 1) {
        const dist = Math.abs(lx + ly - 1);
        return dist < MARGIN;
      } else {
        const dist = Math.abs(lx - ly);
        return dist < MARGIN;
      }
    }

    case "thin": {
      // Thin wall is a narrow strip centered in the tile.
      // Solid if player is within [planeOffset, planeOffset+thickness] on both axes.
      const off   = geo.planeOffset ?? 0.45;
      const thick = geo.thickness   ?? 0.1;
      // Check Y-parallel plane (horizontal strip)
      const inYStrip = ly >= off && ly <= off + thick;
      // Check X-parallel plane (vertical strip)
      const inXStrip = lx >= off && lx <= off + thick;
      return inYStrip || inXStrip;
    }

    case "pillar": {
      // Circle centered at (0.5, 0.5)
      const r  = geo.radius ?? 0.1;
      const dx = lx - 0.5;
      const dy = ly - 0.5;
      return dx * dx + dy * dy < r * r;
    }

    default:
      return false;
  }
}

// ── isWall ────────────────────────────────────────────────────────────────────
// Drop-in replacement for the original. Same call signature.
// player.js calls this at 4 corners of the player bounding box — each corner
// gets the precise geometry test for its tile, so hitboxes match visuals.

export function isWall(x, y) {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  const char  = map[tileY]?.[tileX];
  if (!char) return false;
  const geo = getGeometry(char);
  if (!geo) return false;
  return collidesWithGeometry(geo, x, y, tileX, tileY);
}