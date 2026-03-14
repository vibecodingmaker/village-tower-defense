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
      {id: 0, cx:275, cy:448}, // left  of entry vertical  x=320
      {id: 1, cx:365, cy:448}, // right of entry vertical
      {id: 2, cx:234, cy:393}, // above horizontal y=438
      {id: 3, cx:103, cy:310}, // left  of vertical x=148 (above tree cluster)
      {id: 4, cx:180, cy:277}, // above horizontal y=322 (left portion)
      {id: 5, cx:275, cy:265}, // left  of vertical x=320 (mid)
      {id: 6, cx:365, cy:265}, // right of vertical x=320 (mid)
      {id: 7, cx:350, cy:163}, // above horizontal y=208
      {id: 8, cx:427, cy:253}, // below horizontal y=208
      {id: 9, cx:517, cy:158}, // right of vertical x=472
      {id:10, cx:396, cy: 63}, // above horizontal y=108
      {id:11, cx:450, cy: 63}, // above horizontal y=108 (right portion)
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
      {id: 0, cx:115, cy:450}, // left  of left-entry  x=160
      {id: 1, cx:205, cy:400}, // right of left-entry (shifted up to clear tree)
      {id: 2, cx: 35, cy:225}, // left  of left-vertical x=80
      {id: 3, cx:125, cy:225}, // right of left-vertical
      {id: 4, cx: 35, cy:148}, // left  of left-vertical top
      {id: 5, cx:435, cy:400}, // left  of right-entry x=480 (shifted up to clear tree)
      {id: 6, cx:525, cy:450}, // right of right-entry
      {id: 7, cx:515, cy:250}, // left  of right-vertical x=560 (shifted down to clear tree)
      {id: 8, cx:605, cy:225}, // right of right-vertical
      {id: 9, cx:605, cy:148}, // right of right-vertical top
      {id:10, cx:220, cy:118}, // below left upper-diagonal
      {id:11, cx:420, cy:118}, // below right upper-diagonal
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
      {id: 0, cx:275, cy:448}, // left  of entry x=320
      {id: 1, cx:365, cy:448}, // right of entry
      {id: 2, cx: 35, cy:350}, // 45 px left of turn (80,350)
      {id: 3, cx: 35, cy:190}, // 45 px left of turn (80,190)
      {id: 4, cx:605, cy:270}, // 45 px right of turn (560,270)
      {id: 5, cx:605, cy:118}, // right of turn (560,110) — shifted to clear INN bottom
      {id: 6, cx: 35, cy:305}, // above left turn 1 corner
      {id: 7, cx: 40, cy:145}, // above left turn 2 corner
      {id: 8, cx:207, cy:374}, // below D2 sweep mid-left (avoids right-side trees)
      {id: 9, cx:320, cy:120}, // above D4 sweep centre (clear of INN & trees)
      {id:10, cx:275, cy: 72}, // left  of top exit x=320
      {id:11, cx:365, cy: 72}, // right of top exit
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
      {id: 0, cx:365, cy:448}, // right of entry vertical x=320 (shifted to clear edge)
      {id: 1, cx: 35, cy:405}, // left  of outer vertical x=80  (upper area)
      {id: 2, cx: 35, cy:255}, // left  of outer vertical x=80  (mid)
      {id: 3, cx:125, cy:255}, // right of outer vertical x=80
      {id: 4, cx:275, cy:105}, // below top horizontal y=60 (left)
      {id: 5, cx:440, cy:105}, // below top horizontal y=60 (right)
      {id: 6, cx:515, cy:255}, // left  of right vertical x=560 (shifted to clear tree)
      {id: 7, cx:380, cy:335}, // above inner horizontal y=380
      {id: 8, cx:155, cy:280}, // left  of inner vertical x=200
      {id: 9, cx:375, cy:135}, // above inner horizontal y=180
      {id:10, cx:415, cy:230}, // left  of inner vertical x=460
      {id:11, cx:275, cy:280}, // left  of inner horizontal y=280 end
    ],
  },

  // ── Map 4: Double Cross (2 paths that criss-cross) ──────────────────────
  {
    id: 4, label: "Double Cross",
    paths: [
      [{x:100,y:500},{x:100,y:320},{x:400,y:210},{x:540,y:80},{x:320,y:-20}],
      [{x:540,y:500},{x:540,y:320},{x:240,y:210},{x:100,y:80},{x:320,y:-20}],
    ],
    // Spots placed 45 px perpendicular to each diagonal / vertical segment
    spots: [
      {id: 0, cx: 55, cy:330}, // left  of left-entry x=100 (shifted up to clear trees)
      {id: 1, cx:145, cy:410}, // right of left-entry
      {id: 2, cx:266, cy:307}, // right of left diagonal D1  (45 px perp)
      {id: 3, cx:501, cy:178}, // right of left diagonal D2  (45 px perp)
      {id: 4, cx:439, cy:112}, // left  of left diagonal D2  (45 px perp)
      {id: 5, cx:495, cy:280}, // left  of right-entry x=540 (shifted up to clear PUB)
      {id: 6, cx:585, cy:448}, // right of right-entry (shifted down to clear PUB)
      {id: 7, cx:375, cy:307}, // right of right diagonal D1 (45 px perp)
      {id: 8, cx:139, cy:178}, // right of right diagonal D2 (45 px perp)
      {id: 9, cx:201, cy:112}, // left  of right diagonal D2 (45 px perp)
      {id:10, cx:320, cy:284}, // 45 px below D1/D1 crossing (320,239)
      {id:11, cx:320, cy:194}, // 45 px above D1/D1 crossing
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

  add("goblin",      Math.min(7  + Math.ceil(n * 1.7),  45), 1.4, 1.1);
  if (n >= 3)  add("skeleton",    Math.min(Math.ceil((n-2)*1.2), 22), 2.0, 1.0);
  if (n >= 4)  add("orc",         Math.min(Math.ceil((n-3)*0.9), 18), 2.5, 2.0);
  if (n >= 6)  add("troll",       Math.min(Math.ceil((n-5)*0.6), 12), 3.5, 4.0);
  if (n >= 7)  add("dragon",      Math.min(Math.ceil((n-6)*0.5), 10), 2.0, 2.5);
  if (n >= 8)  add("ogre",        Math.min(Math.ceil((n-7)*0.4),  7), 4.0, 5.0);
  if (n >= 9)  add("harpy",       Math.min(Math.ceil((n-8)*0.6), 12), 1.5, 1.8);
  if (n >= 12) add("necromancer", Math.min(Math.ceil((n-11)*0.3), 5), 3.0, 6.0);
  if (n >= 15) add("demon",       Math.min(Math.ceil((n-14)*0.3), 6), 2.5, 3.5);
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
