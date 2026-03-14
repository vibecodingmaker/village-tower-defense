"use strict";
// ─── Canvas / map constants ────────────────────────────────────────────────
const CVW = 640, CVH = 480;
const ROAD_W = 36;
const SPOT_R = 22;

// ─── Grid tile system ─────────────────────────────────────────────────────
const TILE       = 32;               // pixel size of one grid cell
const GRID_COLS  = CVW / TILE | 0;  // 20 columns
const GRID_ROWS  = CVH / TILE | 0;  // 15 rows

// Snap an arbitrary pixel coordinate to the nearest tile centre
function snapToGrid(v) { return (Math.floor(v / TILE) * TILE) + TILE / 2; }

// Minimum distance from point (px,py) to line segment (ax,ay)→(bx,by)
function ptSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ─── Map library — 5 maps cycling every 10 waves ──────────────────────────
// Each map: { id, label, paths[][], spots[] }
// paths = array of waypoint arrays; multi-element = multiple roads
// All spots are placed 45-65 px from the nearest road centre so that every
// tower type (including the shortest-range Twins Dagger at 65 px) can fire
// at enemies from any build spot at level 0.
const MAPS = [

  // ── Map 0: Village Road (single winding road) ──────────────────────────
  {
    id: 0, label: "Village Road",
    paths: [[
      {x:320,y:500},{x:320,y:438},{x:148,y:438},{x:148,y:322},
      {x:320,y:322},{x:320,y:208},{x:472,y:208},{x:472,y:108},
      {x:320,y:108},{x:320,y:-20},
    ]],
    spots: [
      {id: 0, cx:496, cy:240},
      {id: 1, cx:112, cy:304},
      {id: 2, cx:336, cy:400},
      {id: 3, cx:208, cy:368},
      {id: 4, cx:272, cy:368},
      {id: 5, cx:272, cy: 48},
      {id: 6, cx:368, cy: 48},
      {id: 7, cx:272, cy:240},
      {id: 8, cx:368, cy:272},
      {id: 9, cx:272, cy:112},
      {id:10, cx:368, cy:432},
      {id:11, cx:176, cy:272},
      {id:12, cx:240, cy:272},
      {id:13, cx:368, cy:336},
      {id:14, cx:528, cy:176},
      {id:15, cx:432, cy: 48},
    ],
  },

  // ── Map 1: Twin Forks (2 roads — left & right, merge at top) ───────────
  {
    id: 1, label: "Twin Forks",
    paths: [
      [{x:160,y:500},{x:160,y:400},{x:80,y:300},{x:80,y:150},{x:210,y:70},{x:320,y:40},{x:320,y:-20}],
      [{x:480,y:500},{x:480,y:400},{x:560,y:300},{x:560,y:150},{x:430,y:70},{x:320,y:40},{x:320,y:-20}],
    ],
    spots: [
      {id: 0, cx:176, cy:144},
      {id: 1, cx:464, cy:144},
      {id: 2, cx:144, cy:304},
      {id: 3, cx: 48, cy:336},
      {id: 4, cx:496, cy:304},
      {id: 5, cx:208, cy:400},
      {id: 6, cx:432, cy:400},
      {id: 7, cx:112, cy:432},
      {id: 8, cx:240, cy:112},
      {id: 9, cx:400, cy:112},
      {id:10, cx:176, cy:336},
      {id:11, cx:464, cy:336},
      {id:12, cx:496, cy: 48},
      {id:13, cx:144, cy:176},
      {id:14, cx:496, cy:176},
    ],
  },

  // ── Map 2: Zigzag Alley ─────────────────────────────────────────────────
  {
    id: 2, label: "Zigzag Alley",
    paths: [[
      {x:320,y:500},{x:320,y:430},
      {x:80,y:350},{x:560,y:270},
      {x:80,y:190},{x:560,y:110},
      {x:320,y:40},{x:320,y:-20},
    ]],
    spots: [
      {id: 0, cx:432, cy:208},
      {id: 1, cx:304, cy:272},
      {id: 2, cx:112, cy:304},
      {id: 3, cx:304, cy:112},
      {id: 4, cx:496, cy: 48},
      {id: 5, cx:272, cy:368},
      {id: 6, cx:592, cy:240},
      {id: 7, cx:112, cy:240},
      {id: 8, cx:432, cy:336},
      {id: 9, cx:368, cy:432},
      {id:10, cx:272, cy: 48},
      {id:11, cx:464, cy:176},
      {id:12, cx:240, cy:112},
      {id:13, cx:496, cy:208},
      {id:14, cx:240, cy:272},
      {id:15, cx:144, cy:432},
      {id:16, cx:336, cy:368},
      {id:17, cx:528, cy:176},
      {id:18, cx:176, cy:112},
      {id:19, cx:176, cy:272},
    ],
  },

  // ── Map 3: Spiral Keep (tight inward spiral) ────────────────────────────
  {
    id: 3, label: "Spiral Keep",
    paths: [[
      {x:320,y:500},{x:320,y:450},
      {x:80,y:450},{x:80,y:60},{x:560,y:60},
      {x:560,y:380},{x:200,y:380},{x:200,y:180},
      {x:460,y:180},{x:460,y:280},{x:320,y:280},{x:320,y:-20},
    ]],
    spots: [
      {id: 0, cx:368, cy:240},
      {id: 1, cx:240, cy:272},
      {id: 2, cx:240, cy:336},
      {id: 3, cx:176, cy:144},
      {id: 4, cx:496, cy:304},
      {id: 5, cx:304, cy:336},
      {id: 6, cx:368, cy:336},
      {id: 7, cx:432, cy:336},
      {id: 8, cx:272, cy:112},
      {id: 9, cx:368, cy:112},
      {id:10, cx:272, cy:240},
      {id:11, cx:144, cy:400},
      {id:12, cx:368, cy:432},
      {id:13, cx:208, cy:112},
      {id:14, cx:432, cy:112},
      {id:15, cx:496, cy:112},
      {id:16, cx:464, cy:432},
      {id:17, cx:272, cy:304},
      {id:18, cx:144, cy:208},
      {id:19, cx:144, cy:272},
    ],
  },

  // ── Map 4: Double Cross (2 paths that criss-cross) ──────────────────────
  {
    id: 4, label: "Double Cross",
    paths: [
      [{x:100,y:500},{x:100,y:320},{x:400,y:210},{x:540,y:80},{x:320,y:-20}],
      [{x:540,y:500},{x:540,y:320},{x:240,y:210},{x:100,y:80},{x:320,y:-20}],
    ],
    spots: [
      {id: 0, cx:144, cy:176},
      {id: 1, cx:496, cy:176},
      {id: 2, cx:112, cy:272},
      {id: 3, cx:528, cy:272},
      {id: 4, cx:176, cy:336},
      {id: 5, cx:464, cy:336},
      {id: 6, cx:272, cy: 48},
      {id: 7, cx:368, cy: 48},
      {id: 8, cx:176, cy:208},
      {id: 9, cx:464, cy:208},
      {id:10, cx:272, cy:176},
      {id:11, cx:368, cy:176},
      {id:12, cx:144, cy:368},
      {id:13, cx:144, cy:432},
      {id:14, cx:272, cy:304},
      {id:15, cx:368, cy:304},
      {id:16, cx:432, cy: 80},
      {id:17, cx:240, cy:144},
      {id:18, cx:400, cy:144},
      {id:19, cx:208, cy:112},
    ],
  },
];

// ─── Background obstacle registry ────────────────────────────────────────
// Used by isSpotBlocked() to prevent build spots from overlapping objects
// or sitting too close to the canvas border.

const TREE_R = 14;   // visual foliage radius used for collision

// Trees are declared here (shared with render.js drawBackground)
const BG_TREES = [
  [172,56],[210,72],[208,42],[88,140],[84,178],[82,220],[236,192],[254,208],[232,220],
  [540,50],[580,90],[562,142],[568,198],[546,218],[84,354],[83,410],[540,314],[555,364],[560,417],
  [200,447],[420,452],[440,464],[174,464],[490,464],
];

// Rectangular permanent objects (x, y, w, h)
const BG_OBSTACLES = [
  { x: 10, y: 10, w:132, h: 98 },   // lake + watchtower
  { x:522, y: 18, w: 90, h: 74 },   // INN building
  { x:508, y:328, w:102, h: 82 },   // PUB building
];

// Returns true when a build spot centred at (cx,cy) must be blocked:
//   • too close to canvas wall
//   • overlaps a building, lake, or tree
//   • overlaps a road segment (towers must never stand on the road)
function isSpotBlocked(cx, cy) {
  const r = SPOT_R, wall = 8;
  if (cx - r < wall || cx + r > CVW - wall) return true;
  if (cy - r < wall || cy + r > CVH - wall) return true;
  for (const { x, y, w, h } of BG_OBSTACLES) {
    if (cx + r > x && cx - r < x + w && cy + r > y && cy - r < y + h) return true;
  }
  for (const [tx, ty] of BG_TREES) {
    if (Math.hypot(cx - tx, cy - ty) < r + TREE_R) return true;
  }
  // Road overlap — prevents towers from standing on the path
  const paths = (typeof G !== "undefined" && G.currentMap)
    ? G.currentMap.paths : (typeof MAPS !== "undefined" ? MAPS[0].paths : null);
  if (paths) {
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (ptSegDist(cx, cy, path[i].x, path[i].y, path[i+1].x, path[i+1].y)
            < ROAD_W / 2 + r) return true;
      }
    }
  }
  return false;
}

// ─── Tower definitions ─────────────────────────────────────────────────────
const TOWER_TYPES = {
  cannon:     { name:"Cannon",       cost:75,  desc:"Powerful shots; gains splash at higher levels",         range:85,  damage:18, fireRate:1.40, projSpeed:200, splashR:22,  upgBase:{range:85,  damage:18, fireRate:1.40, splashR:22},  color:"#889aaa" },
  archer:     { name:"Archer",       cost:50,  desc:"Fast, long-range precision shots",                      range:115, damage:9,  fireRate:0.55, projSpeed:290, splashR:0,   upgBase:{range:115, damage:9,  fireRate:0.55},              color:"#9a6830" },
  spawner:    { name:"Barracks",     cost:100, desc:"Spawns soldiers to intercept enemies",                  range:85,  damage:0,  fireRate:0,    projSpeed:0,   splashR:0,   spawnRate:8, maxSoldiers:2, solHp:35, solDmg:6, upgBase:{range:85, spawnRate:8, maxSoldiers:2, solHp:35, solDmg:6}, color:"#4455aa" },
  prototype:  { name:"Prototype",    cost:200, desc:"Sniper energy beam — extreme range, piercing",          range:190, damage:80, fireRate:0.30, projSpeed:450, splashR:0,   pierce:true, upgBase:{range:190, damage:80, fireRate:0.30}, color:"#00ffcc" },
  peacemaker: { name:"Peacemaker",   cost:250, desc:"Minigun — extreme fire rate  [unlocks wave 10]",        range:90,  damage:12, fireRate:4.5,  projSpeed:300, splashR:0,   minWave:10,  upgBase:{range:90,  damage:12, fireRate:4.5},  color:"#ff8800" },
  bonecrusher:{ name:"Bone Crusher", cost:175, desc:"Heavy shot — stuns enemies on hit",                     range:80,  damage:35, fireRate:0.85, projSpeed:220, splashR:28,  stunDur:1.5, upgBase:{range:80, damage:35, fireRate:0.85, splashR:28, stunDur:1.5}, color:"#aa6633" },
  poison:     { name:"Poison Darts", cost:130, desc:"Poisons enemies — damage over time",                    range:110, damage:8,  fireRate:1.2,  projSpeed:260, splashR:0,   poisonDps:5, poisonDur:4, upgBase:{range:110, damage:8, fireRate:1.2, poisonDps:5, poisonDur:4}, color:"#44cc22" },
  missiles:   { name:"Smart Missiles",cost:300,desc:"Fires 3 homing missiles simultaneously",                range:140, damage:55, fireRate:0.6,  projSpeed:180, splashR:35,  multiShot:3, upgBase:{range:140, damage:55, fireRate:0.6, splashR:35}, color:"#ff4444" },
  dagger:     { name:"Twins Dagger", cost:200, desc:"Melee — fastest DPS, close range",                     range:65,  damage:22, fireRate:6.0,  projSpeed:320, splashR:0,   upgBase:{range:65,  damage:22, fireRate:6.0},              color:"#cc44cc" },
  golden:     { name:"Golden Tower", cost:300, desc:"Aura: +60% gold from kills in range",                   range:100, damage:0,  fireRate:0,    projSpeed:0,   splashR:0,   isAura:true, auraType:"gold",                 upgBase:{range:100}, color:"#ffdd00" },
  blackhole:  { name:"Black Hole",   cost:350, desc:"Pulls enemies toward it and crushes them",              range:120, damage:3,  fireRate:8,    projSpeed:0,   splashR:0,   isAura:true, auraType:"pull", pullForce:55,   upgBase:{range:120, damage:3, pullForce:55}, color:"#6600cc" },
  chrono:     { name:"Chrono Field", cost:250, desc:"Slows all enemies in range by 50%",                     range:100, damage:0,  fireRate:0,    projSpeed:0,   splashR:0,   isAura:true, auraType:"slow", slowFactor:0.5, upgBase:{range:100}, color:"#00aaff" },
  axe:        { name:"Logging Axe",  cost:150, desc:"Aura: nearby towers gain +35% dmg & fire rate",         range:90,  damage:0,  fireRate:0,    projSpeed:0,   splashR:0,   isAura:true, auraType:"buff",                 upgBase:{range:90},  color:"#cc8833" },
};

// ─── Enemy definitions ─────────────────────────────────────────────────────
const ENEMY_TYPES = {
  goblin:     { name:"Goblin",       hp:  45, speed: 72, reward:  5, size:10, color:"#22aa22", wobble: 0, flies:false },
  skeleton:   { name:"Skeleton",     hp:  70, speed: 60, reward:  8, size:10, color:"#ddddaa", wobble: 0, flies:false },
  orc:        { name:"Drunk Orc",    hp:  92, speed: 40, reward: 10, size:13, color:"#995500", wobble:14, flies:false },
  troll:      { name:"Troll",        hp: 245, speed: 24, reward: 28, size:17, color:"#557700", wobble: 0, flies:false },
  dragon:     { name:"Dragon",       hp: 145, speed: 74, reward: 22, size:12, color:"#cc2200", wobble: 0, flies:true  },
  ogre:       { name:"Ogre",         hp: 480, speed: 20, reward: 45, size:19, color:"#336611", wobble: 0, flies:false },
  harpy:      { name:"Harpy",        hp:  88, speed: 95, reward: 18, size:11, color:"#9944aa", wobble: 0, flies:true  },
  necromancer:{ name:"Necromancer",  hp: 200, speed: 35, reward: 38, size:13, color:"#440066", wobble: 0, flies:false },
  demon:      { name:"Demon",        hp: 350, speed: 68, reward: 60, size:15, color:"#aa0033", wobble: 0, flies:true  },
  boss:       { name:"☠ BOSS",      hp:2500, speed: 22, reward:200, size:24, color:"#220000", wobble: 0, flies:false, isBoss:true },
};

// ─── Wave generator ────────────────────────────────────────────────────────
// numPaths: how many roads in the current map — enemies distributed across them
function generateWave(n, numPaths) {
  numPaths = numPaths || 1;
  const q   = [];
  const gap = t => Math.max(0.4, t - (n - 1) * 0.04);

  // Difficulty tier bonus: each 10 waves adds 25% more enemies
  const tierMult = 1 + Math.floor((n - 1) / 10) * 0.25;

  const add = (type, cnt, fw, sw) => {
    const total = Math.round(cnt * tierMult);
    for (let i = 0; i < total; i++) {
      // Distribute evenly across roads; bosses always path 0
      const pathIdx = (numPaths > 1 && type !== "boss") ? (i % numPaths) : 0;
      q.push({ type, wait: i === 0 ? fw : gap(sw), pathIdx });
    }
  };

  // Wave 1-2: only a few weak goblins; ramp gradually from wave 3+
  add("goblin",      Math.min(4 + Math.ceil(n * 1.4), 45), 1.8, 1.3);
  if (n >= 3)  add("skeleton",    Math.min(Math.ceil((n-2)*1.0), 22), 2.2, 1.2);
  if (n >= 5)  add("orc",         Math.min(Math.ceil((n-4)*0.8), 18), 2.8, 2.2);
  if (n >= 7)  add("troll",       Math.min(Math.ceil((n-6)*0.55),12), 3.5, 4.0);
  if (n >= 8)  add("dragon",      Math.min(Math.ceil((n-7)*0.45),10), 2.2, 2.5);
  if (n >= 9)  add("ogre",        Math.min(Math.ceil((n-8)*0.38), 7), 4.0, 5.0);
  if (n >= 10) add("harpy",       Math.min(Math.ceil((n-9)*0.55),12), 1.5, 1.8);
  if (n >= 13) add("necromancer", Math.min(Math.ceil((n-12)*0.3), 5), 3.0, 6.0);
  if (n >= 16) add("demon",       Math.min(Math.ceil((n-15)*0.3), 6), 2.5, 3.5);
  if (n % 5 === 0) add("boss",    1 + Math.floor(n / 25), 5.0, 8.0);

  return q;
}

// ─── Random wave events ────────────────────────────────────────────────────
const RANDOM_EVENTS = [
  { text:"🌧 Rainy Day!",        eff:"Enemies 20% slower",            fn:g=>{g.eMod.speed=0.80}},
  { text:"🪣 Mudslide!",         eff:"Enemies 30% slower",            fn:g=>{g.eMod.speed=0.70}},
  { text:"☕ Coffee Break!",    eff:"Towers fire 50% faster",         fn:g=>{g.tMod.rate=1.50}},
  { text:"💰 Lucky Loot!",      eff:"Double gold from kills",         fn:g=>{g.eMod.reward=2}},
  { text:"📣 Enemy Rally!",     eff:"Enemies +25% HP",                fn:g=>{g.eMod.hp=1.25}},
  { text:"🌬 Tailwind!",        eff:"Towers +40% range",              fn:g=>{g.tMod.range=1.40}},
  { text:"🎉 Festival!",        eff:"Towers fire 30% faster",         fn:g=>{g.tMod.rate=1.30}},
  { text:"🐉 Dragon Frenzy!",  eff:"Enemies 25% faster",             fn:g=>{g.eMod.speed=1.25}},
  { text:"🌩 Lightning!",       eff:"Cannons +50% damage",            fn:g=>{g.tMod.cannonDmg=1.50}},
  { text:"🍄 Mushroom Madness!",eff:"Enemies half HP",                fn:g=>{g.eMod.hp=0.50}},
  { text:"⚗ Poison Fog!",      eff:"Poison towers +80% DoT",         fn:g=>{g.tMod.poisonMult=1.80}},
  { text:"❄ Frozen Ground!",   eff:"Enemies 40% slower",             fn:g=>{g.eMod.speed=0.60}},
  { text:"🌟 Power Surge!",     eff:"All towers +60% damage",         fn:g=>{g.tMod.dmgMult=1.60}},
  { text:"💎 Diamond Drop!",    eff:"3× gold from kills",             fn:g=>{g.eMod.reward=3}},
  { text:"🔥 Infernal Wave!",   eff:"Enemies +50% HP & speed",        fn:g=>{g.eMod.hp=1.50; g.eMod.speed=1.30}},
];
