"use strict";
// ─── Canvas / map constants ────────────────────────────────────────────────
const CVW = 640, CVH = 480;
const ROAD_W = 36;   // road stroke width (pixels)
const SPOT_R = 22;   // build-spot half-size (square)

// ─── Enemy path: dirt road from bottom-centre  → top-centre ───────────────
// Inspired by OPP2017 Village tileset layout (OpenGameArt, CC0)
const PATH = [
  {x:320, y:500},  // spawn (off-screen)
  {x:320, y:438},  // enter map
  {x:148, y:438},  // sweep left
  {x:148, y:322},  // march up
  {x:320, y:322},  // cut right
  {x:320, y:208},  // march up
  {x:472, y:208},  // sweep right
  {x:472, y:108},  // march up
  {x:320, y:108},  // cut left
  {x:320, y: -20}, // exit (off-screen)
];

// ─── Tower build spots (grass tiles beside road) ───────────────────────────
const BUILD_SPOTS = [
  {id:0,  cx:392, cy:400},
  {id:1,  cx:244, cy:400},
  {id:2,  cx: 82, cy:382},
  {id:3,  cx: 82, cy:272},
  {id:4,  cx:254, cy:272},
  {id:5,  cx:392, cy:258},
  {id:6,  cx:544, cy:258},
  {id:7,  cx:544, cy:150},
  {id:8,  cx:392, cy:142},
  {id:9,  cx:218, cy:168},
  {id:10, cx:186, cy: 62},
  {id:11, cx:420, cy: 60},
].map(s => ({...s, tower: null}));

// ─── Tower definitions ─────────────────────────────────────────────────────
const TOWER_TYPES = {
  cannon: {
    name:"Cannon", cost:75, desc:"Powerful shots; splash at lv4-5",
    range:85, damage:18, fireRate:1.40, projSpeed:200, splashR:0,
    upgrades:[
      {cost: 70, range: 95, damage: 26, fireRate:1.25, splashR: 0},
      {cost: 90, range:105, damage: 38, fireRate:1.10, splashR: 0},
      {cost:120, range:118, damage: 54, fireRate:0.95, splashR:34},
      {cost:180, range:132, damage: 76, fireRate:0.80, splashR:50},
    ]
  },
  archer: {
    name:"Archer", cost:50, desc:"Fast attack, long range",
    range:115, damage:9, fireRate:0.55, projSpeed:290, splashR:0,
    upgrades:[
      {cost: 45, range:126, damage:13, fireRate:0.47},
      {cost: 65, range:138, damage:19, fireRate:0.39},
      {cost: 85, range:150, damage:28, fireRate:0.32},
      {cost:120, range:164, damage:39, fireRate:0.25},
    ]
  },
  spawner: {
    name:"Barracks", cost:100, desc:"Spawns soldiers to fight enemies",
    range:0, damage:0, fireRate:0, projSpeed:0, splashR:0,
    spawnRate:8, maxSoldiers:2, solHp:35, solDmg:6,
    upgrades:[
      {cost: 80, spawnRate:7, maxSoldiers:3, solHp: 52, solDmg: 9},
      {cost:100, spawnRate:6, maxSoldiers:4, solHp: 78, solDmg:14},
      {cost:130, spawnRate:5, maxSoldiers:5, solHp:115, solDmg:21},
      {cost:180, spawnRate:4, maxSoldiers:6, solHp:165, solDmg:32},
    ]
  }
};

// ─── Enemy definitions ─────────────────────────────────────────────────────
const ENEMY_TYPES = {
  goblin:{ name:"Goblin",    hp: 45, speed: 72, reward: 5, size:10, color:"#22aa22", wobble: 0, flies:false },
  orc:   { name:"Drunk Orc", hp: 92, speed: 40, reward:10, size:13, color:"#995500", wobble:14, flies:false },
  troll: { name:"Troll",     hp:245, speed: 24, reward:28, size:17, color:"#557700", wobble: 0, flies:false },
  dragon:{ name:"Dragon",    hp:145, speed: 74, reward:22, size:12, color:"#cc2200", wobble: 0, flies:true  },
};

// ─── Wave generator ────────────────────────────────────────────────────────
// Returns array of {type, wait} — wait = seconds before spawning this unit
function generateWave(n) {
  const q   = [];
  const gap = t => Math.max(t * 0.5, t - (n - 1) * 0.05);

  // Goblins (always)
  const gc = Math.min(5 + Math.ceil(n * 1.6), 30);
  for (let i = 0; i < gc; i++) q.push({type:"goblin", wait: i===0 ? 1.5 : gap(1.2)});
  // Orcs (wave 2+)
  if (n >= 2) {
    const oc = Math.min(Math.ceil((n-1) * 0.9), 16);
    for (let i = 0; i < oc; i++) q.push({type:"orc", wait: i===0 ? 2.5 : gap(2.0)});
  }
  // Trolls (wave 4+)
  if (n >= 4) {
    const tc = Math.min(Math.ceil((n-3) * 0.5), 10);
    for (let i = 0; i < tc; i++) q.push({type:"troll", wait: i===0 ? 3.5 : gap(4.0)});
  }
  // Dragons (wave 5+)
  if (n >= 5) {
    const dc = Math.min(Math.ceil((n-4) * 0.4), 8);
    for (let i = 0; i < dc; i++) q.push({type:"dragon", wait: i===0 ? 2.0 : gap(2.5)});
  }
  return q;
}

// ─── Random wave events ────────────────────────────────────────────────────
const RANDOM_EVENTS = [
  {text:"🌧 Rainy Day!",         eff:"Enemies move 20% slower",       fn:g=>{g.eMod.speed=0.80}},
  {text:"🪣 Mudslide!",          eff:"Enemies move 30% slower",       fn:g=>{g.eMod.speed=0.70}},
  {text:"☕ Coffee Break!",     eff:"All towers fire 50% faster",    fn:g=>{g.tMod.rate=1.50}},
  {text:"💰 Lucky Loot!",       eff:"Double gold from kills",        fn:g=>{g.eMod.reward=2}},
  {text:"📣 Enemy Rally!",      eff:"Enemies have 25% more HP",      fn:g=>{g.eMod.hp=1.25}},
  {text:"🌬 Tailwind!",         eff:"All towers +40% range",         fn:g=>{g.tMod.range=1.40}},
  {text:"🎉 Village Festival!", eff:"Towers fire 30% faster",        fn:g=>{g.tMod.rate=1.30}},
  {text:"🐉 Dragon Frenzy!",   eff:"All enemies 25% faster",        fn:g=>{g.eMod.speed=1.25}},
  {text:"🌩 Lightning Storm!",  eff:"Cannons deal +50% damage",      fn:g=>{g.tMod.cannonDmg=1.50}},
  {text:"🍄 Mushroom Madness!", eff:"Enemies shrink — half HP",      fn:g=>{g.eMod.hp=0.50}},
];
