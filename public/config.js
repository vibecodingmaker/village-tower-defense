"use strict";
// ─── Canvas / map constants ────────────────────────────────────────────────
const CVW = 640, CVH = 480;
const ROAD_W = 36;
const SPOT_R = 22;

// ─── Enemy path ────────────────────────────────────────────────────────────
const PATH = [
  {x:320, y:500}, {x:320, y:438}, {x:148, y:438}, {x:148, y:322},
  {x:320, y:322}, {x:320, y:208}, {x:472, y:208}, {x:472, y:108},
  {x:320, y:108}, {x:320, y:-20},
];

// ─── Build spots ───────────────────────────────────────────────────────────
const BUILD_SPOTS = [
  {id:0,  cx:392, cy:400}, {id:1,  cx:244, cy:400}, {id:2,  cx: 82, cy:382},
  {id:3,  cx: 82, cy:272}, {id:4,  cx:254, cy:272}, {id:5,  cx:392, cy:258},
  {id:6,  cx:544, cy:258}, {id:7,  cx:544, cy:150}, {id:8,  cx:392, cy:142},
  {id:9,  cx:218, cy:168}, {id:10, cx:186, cy: 62}, {id:11, cx:420, cy: 60},
].map(s => ({...s, tower: null}));

// ─── Tower definitions ─────────────────────────────────────────────────────
// upgBase: base stats used by formula-based 999-level upgrade system
// isAura: true = no projectiles, effect applied directly each frame
const TOWER_TYPES = {

  // ── Classic ──────────────────────────────────────────────────────────────
  cannon: {
    name:"Cannon", cost:75, desc:"Powerful cannon — gains splash at higher levels",
    range:85, damage:18, fireRate:1.40, projSpeed:200, splashR:22,
    upgBase:{range:85, damage:18, fireRate:1.40, splashR:22}, color:"#889aaa",
  },
  archer: {
    name:"Archer", cost:50, desc:"Fast, long-range precision shots",
    range:115, damage:9, fireRate:0.55, projSpeed:290, splashR:0,
    upgBase:{range:115, damage:9, fireRate:0.55}, color:"#9a6830",
  },
  spawner: {
    name:"Barracks", cost:100, desc:"Spawns soldiers to intercept enemies",
    range:85, damage:0, fireRate:0, projSpeed:0, splashR:0,
    spawnRate:8, maxSoldiers:2, solHp:35, solDmg:6,
    upgBase:{range:85, spawnRate:8, maxSoldiers:2, solHp:35, solDmg:6}, color:"#4455aa",
  },

  // ── Ranged / Mechanical ───────────────────────────────────────────────────
  prototype: {
    name:"Prototype", cost:200, desc:"Sniper energy beam — extreme range, piercing shot",
    range:190, damage:80, fireRate:0.30, projSpeed:450, splashR:0, pierce:true,
    upgBase:{range:190, damage:80, fireRate:0.30}, color:"#00ffcc",
  },
  peacemaker: {
    name:"Peacemaker", cost:250, desc:"Minigun — extreme fire rate  [unlocks wave 10]",
    range:90, damage:12, fireRate:4.5, projSpeed:300, splashR:0, minWave:10,
    upgBase:{range:90, damage:12, fireRate:4.5}, color:"#ff8800",
  },
  bonecrusher: {
    name:"Bone Crusher", cost:175, desc:"Heavy shot — stuns enemies on hit",
    range:80, damage:35, fireRate:0.85, projSpeed:220, splashR:28, stunDur:1.5,
    upgBase:{range:80, damage:35, fireRate:0.85, splashR:28, stunDur:1.5}, color:"#aa6633",
  },
  poison: {
    name:"Poison Darts", cost:130, desc:"Poisons enemies — damage over time",
    range:110, damage:8, fireRate:1.2, projSpeed:260, splashR:0, poisonDps:5, poisonDur:4,
    upgBase:{range:110, damage:8, fireRate:1.2, poisonDps:5, poisonDur:4}, color:"#44cc22",
  },
  missiles: {
    name:"Smart Missiles", cost:300, desc:"Fires 3 homing missiles simultaneously",
    range:140, damage:55, fireRate:0.6, projSpeed:180, splashR:35, multiShot:3,
    upgBase:{range:140, damage:55, fireRate:0.6, splashR:35}, color:"#ff4444",
  },
  dagger: {
    name:"Twins Dagger", cost:200, desc:"Blinding melee DPS — highest potential damage",
    range:52, damage:22, fireRate:6.0, projSpeed:320, splashR:0,
    upgBase:{range:52, damage:22, fireRate:6.0}, color:"#cc44cc",
  },

  // ── Aura / Special ────────────────────────────────────────────────────────
  golden: {
    name:"Golden Tower", cost:300, desc:"Aura: +60% gold from kills in range",
    range:100, damage:0, fireRate:0, projSpeed:0, splashR:0,
    isAura:true, auraType:"gold",
    upgBase:{range:100}, color:"#ffdd00",
  },
  blackhole: {
    name:"Black Hole", cost:350, desc:"Pulls enemies toward it and crushes them",
    range:120, damage:3, fireRate:8, projSpeed:0, splashR:0,
    isAura:true, auraType:"pull", pullForce:55,
    upgBase:{range:120, damage:3, pullForce:55}, color:"#6600cc",
  },
  chrono: {
    name:"Chrono Field", cost:250, desc:"Slows all enemies in range by 50%",
    range:100, damage:0, fireRate:0, projSpeed:0, splashR:0,
    isAura:true, auraType:"slow", slowFactor:0.5,
    upgBase:{range:100}, color:"#00aaff",
  },
  axe: {
    name:"Logging Axe", cost:150, desc:"Aura: nearby towers gain +35% dmg & fire rate",
    range:90, damage:0, fireRate:0, projSpeed:0, splashR:0,
    isAura:true, auraType:"buff",
    upgBase:{range:90}, color:"#cc8833",
  },
};

// ─── Enemy definitions ─────────────────────────────────────────────────────
// HP / speed / reward are BASE values — wave scaling is applied in the Enemy constructor
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
// Enemies unlock by wave; boss spawns every 5 waves (stronger each time)
function generateWave(n) {
  const q   = [];
  const gap = t => Math.max(0.4, t - (n - 1) * 0.04);
  const add = (type, cnt, fw, sw) => {
    for (let i = 0; i < cnt; i++) q.push({ type, wait: i === 0 ? fw : gap(sw) });
  };

  add("goblin",      Math.min(6  + Math.ceil(n * 1.6),  40), 1.5, 1.2);
  if (n >= 3)  add("skeleton",    Math.min(Math.ceil((n-2)*1.2), 22), 2.0, 1.0);
  if (n >= 4)  add("orc",         Math.min(Math.ceil((n-3)*0.9), 18), 2.5, 2.0);
  if (n >= 6)  add("troll",       Math.min(Math.ceil((n-5)*0.6), 12), 3.5, 4.0);
  if (n >= 7)  add("dragon",      Math.min(Math.ceil((n-6)*0.5), 10), 2.0, 2.5);
  if (n >= 8)  add("ogre",        Math.min(Math.ceil((n-7)*0.4),  7), 4.0, 5.0);
  if (n >= 9)  add("harpy",       Math.min(Math.ceil((n-8)*0.6), 12), 1.5, 1.8);
  if (n >= 12) add("necromancer", Math.min(Math.ceil((n-11)*0.3), 5), 3.0, 6.0);
  if (n >= 15) add("demon",       Math.min(Math.ceil((n-14)*0.3), 6), 2.5, 3.5);
  // Boss: 1 at wave 5, +1 extra per 25 waves
  if (n % 5 === 0) add("boss", 1 + Math.floor(n / 25), 5.0, 8.0);

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
