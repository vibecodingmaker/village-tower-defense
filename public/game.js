"use strict";
// ─── Canvas setup ─────────────────────────────────────────────────────────
const canvas = document.getElementById("game");
const ctx    = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// Scale canvas to fit window (pixelated)
function fitCanvas() {
  const sx = (window.innerWidth  - 210) / CVW;   // leave sidebar space
  const sy =  window.innerHeight         / CVH;
  const s  = Math.min(1, sx, sy);
  canvas.style.width  = (CVW * s) + "px";
  canvas.style.height = (CVH * s) + "px";
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

// ─── DOM refs ─────────────────────────────────────────────────────────────
const el = {
  wave:    document.getElementById("wave-num"),
  gold:    document.getElementById("gold"),
  lives:   document.getElementById("lives"),
  score:   document.getElementById("score"),
  best:    document.getElementById("best"),
  msg:     document.getElementById("message"),
  info:    document.getElementById("info-content"),
  upgBtn:  document.getElementById("upgrade-btn"),
  sellBtn: document.getElementById("sell-btn"),
  startBtn:document.getElementById("start-btn"),
  evtBox:  document.getElementById("event-box"),
  evtTxt:  document.getElementById("event-text"),
  overlay: document.getElementById("overlay"),
  ovTitle: document.getElementById("ov-title"),
  ovBody:  document.getElementById("ov-body"),
  ovBtn:   document.getElementById("ov-btn"),
};

// ─── Game state ───────────────────────────────────────────────────────────
const G = {
  state:    "title",   // title | playing | gameover
  gold:     150,
  lives:    10,
  wave:     0,
  score:    0,
  best:     parseInt(localStorage.getItem("vtd_best") || "0"),

  enemies:  [],
  projs:    [],
  parts:    [],
  floats:   [],

  spots:    BUILD_SPOTS,
  selSpot:  null,
  selTower: null,
  placing:  null,     // tower type being placed

  waveOn:   false,
  spawnQ:   [],
  spawnT:   0,

  eMod: { speed:1, hp:1, reward:1 },
  tMod: { rate:1, range:1, cannonDmg:1 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function syncDom() {
  el.wave.textContent  = G.wave;
  el.gold.textContent  = G.gold;
  el.lives.textContent = G.lives;
  el.score.textContent = G.score;
  el.best.textContent  = G.best;
}

let _msgTimer = 0;
function showMsg(txt, dur=3.5) {
  el.msg.textContent = txt;
  clearTimeout(_msgTimer);
  if (dur > 0) _msgTimer = setTimeout(() => { if (el.msg.textContent===txt) el.msg.textContent=""; }, dur*1000);
}

function updateInfo() {
  const t = G.selTower;
  if (t) {
    const uc = t.upgradeCost();
    let html = `<b>${t.name}</b> Lv${t.level+1}/${t.maxLv+1}<br>`;
    if (t.type==="spawner") html += `Soldiers: ${t.soldiers.filter(s=>!s.dead).length}/${t.maxSol}<br>Spawn every: ${t.spawnRate}s<br>`;
    else html += `Dmg: ${t.damage} | Rng: ${t.range}<br>Rate: ${t.fireRate.toFixed(2)}/s<br>`;
    html += `Sell: <span style="color:#ffcc00">${t.sellValue()}g</span>`;
    el.info.innerHTML = html;
    el.upgBtn.style.display  = uc ? "block" : "none";
    if (uc) el.upgBtn.textContent = `⬆ Upgrade (${uc}g)`;
    el.sellBtn.style.display = "block";
  } else if (G.placing) {
    const d = TOWER_TYPES[G.placing];
    el.info.innerHTML = `<b>${d.name}</b><br>${d.desc}<br>Cost: <span style="color:#ffcc00">${d.cost}g</span>`;
    el.upgBtn.style.display = el.sellBtn.style.display = "none";
  } else {
    el.info.innerHTML = 'Click a <span style="color:#88ff88">■</span> to build<br>Click tower to manage';
    el.upgBtn.style.display = el.sellBtn.style.display = "none";
  }
}

function addParticles(x, y, color, n=12) {
  for (let i=0; i<n; i++) {
    const a=Math.random()*Math.PI*2, sp=20+Math.random()*90;
    G.parts.push(new Particle(x,y, Math.cos(a)*sp, Math.sin(a)*sp-30, color, 0.5+Math.random()*0.7, (2+Math.random()*3)|0));
  }
}
function addFloat(x,y,txt,col="#ffee00") { G.floats.push(new FloatingText(x,y,txt,col)); }
function allTowers() { return G.spots.filter(s=>s.tower).map(s=>s.tower); }

// ─── UI event listeners ───────────────────────────────────────────────────
document.querySelectorAll(".tbtn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (G.state !== "playing") return;
    G.placing  = btn.dataset.type;
    G.selTower = null;
    G.selSpot  = null;
    document.querySelectorAll(".tbtn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const d = TOWER_TYPES[G.placing];
    showMsg(`Click a green ■ to place ${d.name} (${d.cost}g)`);
    updateInfo();
  });
});

el.startBtn.addEventListener("click", () => {
  if (G.state==="playing" && !G.waveOn) startWave();
});

el.upgBtn.addEventListener("click", () => {
  const t=G.selTower; if(!t) return;
  const uc=t.upgradeCost();
  if (uc===null) { showMsg("Max level already!"); return; }
  if (G.gold < uc) { showMsg("Not enough gold!"); return; }
  G.gold -= uc; t.doUpgrade();
  showMsg(`${t.name} → Level ${t.level+1}!`);
  updateInfo(); syncDom();
});

el.sellBtn.addEventListener("click", () => {
  const t=G.selTower; if(!t) return;
  const v=t.sellValue();
  G.gold += v;
  const sp=G.spots.find(s=>s.id===t.spotId);
  if (sp) sp.tower=null;
  G.selTower=null; G.selSpot=null;
  showMsg(`Sold for ${v}g`); updateInfo(); syncDom();
});

el.ovBtn.addEventListener("click", () => { el.overlay.style.display="none"; initGame(); });

// ─── Canvas click ─────────────────────────────────────────────────────────
canvas.addEventListener("click", e => {
  if (G.state === "title") { initGame(); return; }
  if (G.state !== "playing") return;

  const r=canvas.getBoundingClientRect();
  const mx=(e.clientX-r.left)*(CVW/r.width);
  const my=(e.clientY-r.top)*(CVH/r.height);

  for (const s of G.spots) {
    if (Math.abs(mx-s.cx)<=SPOT_R && Math.abs(my-s.cy)<=SPOT_R) {
      if (s.tower) {
        G.selTower=s.tower; G.selSpot=s.id; G.placing=null;
        document.querySelectorAll(".tbtn").forEach(b=>b.classList.remove("active"));
        updateInfo(); return;
      }
      if (G.placing) {
        const cost=TOWER_TYPES[G.placing].cost;
        if (G.gold < cost) { showMsg("Not enough gold!"); return; }
        G.gold -= cost;
        const t=new Tower(G.placing, s.cx, s.cy, s.id);
        s.tower=t; G.selTower=t; G.selSpot=s.id;
        document.querySelectorAll(".tbtn").forEach(b=>b.classList.remove("active"));
        G.placing=null;
        addFloat(s.cx, s.cy-24, `-${cost}g`, "#ff8800");
        showMsg(`${t.name} placed!`); updateInfo(); syncDom(); return;
      }
      G.selSpot=s.id; G.selTower=null; updateInfo(); return;
    }
  }
  G.selSpot=null; G.selTower=null; G.placing=null;
  document.querySelectorAll(".tbtn").forEach(b=>b.classList.remove("active"));
  updateInfo();
});

canvas.addEventListener("mousemove", e => {
  if (G.state!=="playing") return;
  const r=canvas.getBoundingClientRect();
  const mx=(e.clientX-r.left)*(CVW/r.width), my=(e.clientY-r.top)*(CVH/r.height);
  let hov=false;
  for (const s of G.spots) if(!s.tower && Math.abs(mx-s.cx)<=SPOT_R && Math.abs(my-s.cy)<=SPOT_R){ hov=true; break; }
  canvas.style.cursor = (hov||G.placing) ? "pointer" : "default";
});

// ─── Wave management ──────────────────────────────────────────────────────
function startWave() {
  G.wave++; G.waveOn=true;
  G.eMod = { speed:1, hp:1, reward:1 };
  G.tMod = { rate:1, range:1, cannonDmg:1 };

  if (G.wave % 5 === 0) {
    const ev=RANDOM_EVENTS[Math.floor(Math.random()*RANDOM_EVENTS.length)];
    ev.fn(G);
    el.evtBox.style.display="block";
    el.evtTxt.textContent=ev.eff;
    showMsg(`${ev.text}  —  ${ev.eff}`, 6);
    setTimeout(()=>el.evtBox.style.display="none", 7000);
  }

  G.spawnQ=generateWave(G.wave);
  G.spawnT=G.spawnQ.length ? G.spawnQ[0].wait : 999;
  el.startBtn.disabled=true;
  showMsg(`⚔ Wave ${G.wave} approaching!`);
  syncDom();
}

function onWaveEnd() {
  G.waveOn=false;
  const bonus=G.wave*15+20;
  G.gold  += bonus;
  G.score += G.wave*100;
  if (G.wave > G.best) { G.best=G.wave; localStorage.setItem("vtd_best", G.best); }
  el.startBtn.disabled=false;
  showMsg(`✓ Wave ${G.wave} cleared!  +${bonus}g bonus`, 4);
  syncDom();
}

function loseLife(n=1) {
  G.lives-=n; if(G.lives<=0){ G.lives=0; gameOver(); } syncDom();
}

function gameOver() {
  G.state="gameover";
  el.ovTitle.textContent="Village Overrun!";
  el.ovBody.innerHTML=`Survived <b>${G.wave}</b> waves!<br>Score: <b>${G.score}</b><br>Best: <b>${G.best}</b> waves`;
  el.overlay.style.display="flex";
}

// ─── Game init ────────────────────────────────────────────────────────────
function initGame() {
  G.state="playing"; G.gold=150; G.lives=10; G.wave=0; G.score=0;
  G.enemies=[]; G.projs=[]; G.parts=[]; G.floats=[];
  G.selSpot=null; G.selTower=null; G.placing=null;
  G.waveOn=false; G.spawnQ=[]; G.spawnT=0;
  G.eMod={speed:1,hp:1,reward:1}; G.tMod={rate:1,range:1,cannonDmg:1};
  for (const s of G.spots) s.tower=null;
  el.startBtn.disabled=false;
  el.overlay.style.display="none";
  el.evtBox.style.display="none";
  document.querySelectorAll(".tbtn").forEach(b=>b.classList.remove("active"));
  syncDom(); updateInfo();
  showMsg("Place towers on green ■ spots, then press START WAVE!", 7);
}

// ─── Update ───────────────────────────────────────────────────────────────
function update(dt) {
  // Spawn
  if (G.waveOn && G.spawnQ.length > 0) {
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      const item=G.spawnQ.shift();
      G.enemies.push(new Enemy(item.type, G.wave, G.eMod));
      G.spawnT=G.spawnQ.length ? G.spawnQ[0].wait : 999;
    }
  }

  const towers=allTowers();

  // Enemies
  for (const e of G.enemies) {
    e.update(dt);
    if (e.dead) {
      G.gold+=e.reward; G.score+=e.reward*3;
      addParticles(e.x,e.y,e.color,14);
      addFloat(e.x,e.y-22,`+${e.reward}g`);
      for (const t of towers) if(t.target===e) t.target=null;
      syncDom();
    } else if (e.escaped) {
      loseLife();
      addFloat(320,20,"Enemy escaped!","#ff4444");
    }
  }
  G.enemies=G.enemies.filter(e=>!e.dead&&!e.escaped);

  // Towers + soldiers
  for (const t of towers) t.update(dt, G.enemies, G.projs, G.tMod);

  // Projectiles
  for (const p of G.projs) p.update(dt, G.enemies);
  G.projs=G.projs.filter(p=>!p.dead);

  // Particles + floats
  for (const p of G.parts)  p.update(dt);  G.parts=G.parts.filter(p=>!p.dead);
  for (const f of G.floats) f.update(dt);  G.floats=G.floats.filter(f=>!f.dead);

  // Wave complete?
  if (G.waveOn && G.spawnQ.length===0 && G.enemies.length===0) onWaveEnd();
}

// ─── Render ───────────────────────────────────────────────────────────────
function render() {
  drawBackground(ctx);
  drawBuildSpots(ctx, G.spots, G.selSpot, !!G.placing);

  const towers=allTowers();
  if (G.selTower) drawRange(ctx, G.selTower, G.tMod);

  for (const t of towers) {
    drawTower(ctx, t);
    if (t.type==="spawner") t.soldiers.forEach(s=>drawSoldier(ctx,s));
  }

  // Sort enemies by y for correct draw order
  [...G.enemies].sort((a,b)=>a.y-b.y).forEach(e=>drawEnemy(ctx,e));

  G.projs.forEach(p=>drawProjectile(ctx,p));
  G.parts.forEach(p=>drawParticle(ctx,p));
  G.floats.forEach(f=>drawFloat(ctx,f));

  if (G.state==="title") drawTitle(ctx);
}

// ─── Game loop ────────────────────────────────────────────────────────────
let lastT=0;
function loop(now) {
  const dt=Math.min(0.04,(now-lastT)/1000); lastT=now;
  if (G.state==="playing") update(dt);
  render();
  requestAnimationFrame(loop);
}

// ─── Boot ─────────────────────────────────────────────────────────────────
syncDom();
updateInfo();
requestAnimationFrame(loop);
