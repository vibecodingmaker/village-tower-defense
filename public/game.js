"use strict";
// ─── Canvas setup ─────────────────────────────────────────────────────────
const canvas = document.getElementById("game");
const ctx    = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

function isMobile() { return window.innerWidth <= 900; }

function fitCanvas() {
  if (isMobile()) {
    const isLandscape = window.innerWidth > window.innerHeight;
    if (isLandscape) {
      // Landscape phone: sidebar is 160px beside canvas
      const w = window.innerWidth - 160;
      const h = window.innerHeight;
      const s = Math.min(w / CVW, h / CVH);
      canvas.style.width  = (CVW * s) + "px";
      canvas.style.height = (CVH * s) + "px";
    } else {
      // Portrait phone: canvas fills full width
      const w = window.innerWidth;
      canvas.style.width  = w + "px";
      canvas.style.height = Math.round(w * CVH / CVW) + "px";
    }
  } else {
    // Desktop
    const sx = (window.innerWidth  - 220) / CVW;
    const sy =  window.innerHeight         / CVH;
    const s  = Math.min(1, sx, sy);
    canvas.style.width  = (CVW * s) + "px";
    canvas.style.height = (CVH * s) + "px";
  }
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

// ─── DOM refs ─────────────────────────────────────────────────────────────
const el = {
  wave:        document.getElementById("wave-num"),
  gold:        document.getElementById("gold"),
  lives:       document.getElementById("lives"),
  score:       document.getElementById("score"),
  best:        document.getElementById("best"),
  msg:         document.getElementById("message"),
  info:        document.getElementById("info-content"),
  upgBtn:      document.getElementById("upgrade-btn"),
  sellBtn:     document.getElementById("sell-btn"),
  moveBtn:     document.getElementById("move-btn"),
  cancelBtn:   document.getElementById("cancel-move-btn"),
  startBtn:    document.getElementById("start-btn"),
  evtBox:      document.getElementById("event-box"),
  evtTxt:      document.getElementById("event-text"),
  overlay:     document.getElementById("overlay"),
  ovTitle:     document.getElementById("ov-title"),
  ovBody:      document.getElementById("ov-body"),
  ovBtn:       document.getElementById("ov-btn"),
};

// ─── Game state ───────────────────────────────────────────────────────────
const G = {
  state:      "title",
  gold:       150,
  lives:      10,
  wave:       0,
  score:      0,
  best:       parseInt(localStorage.getItem("vtd_best") || "0"),

  currentMap: MAPS[0],
  mapTier:    0,          // 0 = first map; increments by 1 every 10 waves

  enemies:    [],
  projs:      [],
  parts:      [],
  floats:     [],

  spots:      MAPS[0].spots.map(s => ({...s, tower: null})),

  selSpot:    null,
  selTower:   null,
  placing:    null,
  movingTower:null,       // tower currently being relocated
  movingOrigSpot: null,   // original spot id so we can cancel

  mouseX:     320,        // canvas-space cursor position
  mouseY:     240,

  waveOn:     false,
  spawnQ:     [],
  spawnT:     0,

  // Map-change banner state
  mapBanner:  false,
  mapBannerBonus: null,

  eMod: { speed:1, hp:1, reward:1 },
  tMod: { rate:1, range:1, cannonDmg:1, dmgMult:1, poisonMult:1 },
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
function showMsg(txt, dur = 3.5) {
  el.msg.textContent = txt;
  clearTimeout(_msgTimer);
  if (dur > 0) _msgTimer = setTimeout(() => { if (el.msg.textContent === txt) el.msg.textContent = ""; }, dur * 1000);
}

function updateInfo() {
  const t        = G.selTower;
  const moving   = !!G.movingTower;
  const between  = !G.waveOn && G.state === "playing";

  if (moving) {
    const d = TOWER_TYPES[G.movingTower.type];
    el.info.innerHTML = `<b style="color:#00ccff">📦 Moving:</b><br><b>${G.movingTower.name}</b><br>Click a blue ■ to place`;
    el.upgBtn.style.display = el.sellBtn.style.display = el.moveBtn.style.display = "none";
    el.cancelBtn.style.display = "block";
    return;
  }

  if (t) {
    const uc = t.upgradeCost();
    const d  = TOWER_TYPES[t.type];
    let html = `<b style="color:${d.color||'#fff'}">${t.name}</b> <span style="color:#88ff88">Lv${t.level}</span><br>`;
    if (t.type === "spawner") {
      html += `Soldiers: ${t.soldiers.filter(s=>!s.dead).length}/${t.maxSol}<br>`;
      html += `Spawn: ${t.spawnRate.toFixed(1)}s | Dmg: ${t.solDmg}<br>`;
    } else if (t.isAura) {
      html += `Aura range: ${t.range} | ${t.auraType}<br>`;
      if (t.pullForce) html += `Pull: ${t.pullForce.toFixed(0)}/s<br>`;
    } else {
      html += `Dmg: ${t.damage} | Rng: ${t.range}<br>Rate: ${t.fireRate.toFixed(2)}/s`;
      if (t.splashR)   html += ` Spl:${t.splashR}`;
      if (t.stunDur)   html += `<br>Stun: ${t.stunDur.toFixed(1)}s`;
      if (t.poisonDps) html += `<br>Poison: ${t.poisonDps.toFixed(1)}dps×${t.poisonDur.toFixed(1)}s`;
      html += "<br>";
    }
    html += `<span style="color:#ffcc00">Sell: ${t.sellValue()}g</span>`;
    if (uc !== null) html += ` | Next: <span style="color:#88ff88">${uc}g</span>`;
    el.info.innerHTML = html;

    el.upgBtn.style.display  = uc !== null ? "block" : "none";
    if (uc !== null) el.upgBtn.textContent = `⬆ Upgrade (${uc}g)`;
    el.sellBtn.style.display = "block";
    // Move button: only between waves, not during
    el.moveBtn.style.display    = between ? "block" : "none";
    el.cancelBtn.style.display  = "none";
  } else if (G.placing) {
    const d   = TOWER_TYPES[G.placing];
    const req = d.minWave ? `  [Wave ${d.minWave}+]` : "";
    el.info.innerHTML = `<b style="color:${d.color||'#fff'}">${d.name}</b>${req}<br>${d.desc}<br>Cost: <span style="color:#ffcc00">${d.cost}g</span>`;
    el.upgBtn.style.display = el.sellBtn.style.display =
    el.moveBtn.style.display = el.cancelBtn.style.display = "none";
  } else {
    el.info.innerHTML = 'Click a <span style="color:#88ff88">■</span> to build<br>Click tower to inspect/upgrade';
    el.upgBtn.style.display = el.sellBtn.style.display =
    el.moveBtn.style.display = el.cancelBtn.style.display = "none";
  }
}

function addParticles(x, y, color, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 90;
    G.parts.push(new Particle(x, y, Math.cos(a)*sp, Math.sin(a)*sp - 30, color, 0.5+Math.random()*0.7, (2+Math.random()*3)|0));
  }
}
function addFloat(x, y, txt, col = "#ffee00") { G.floats.push(new FloatingText(x, y, txt, col)); }
function allTowers() { return G.spots.filter(s => s.tower).map(s => s.tower); }

// ─── Full refund (100%) for map change ────────────────────────────────────
function fullRefund(tower) {
  const d = TOWER_TYPES[tower.type];
  let total = d.cost;
  for (let i = 0; i < tower.level; i++) {
    total += Math.floor(d.cost * 0.6 * Math.pow(1.11, i));
  }
  return total;
}

// ─── Map switching (every 10 waves) ───────────────────────────────────────
function switchMap() {
  // Refund all placed towers at 100%
  let refund = 0;
  for (const s of G.spots) {
    if (s.tower) { refund += fullRefund(s.tower); }
  }

  G.mapTier  = (G.mapTier + 1) % MAPS.length;
  G.currentMap = MAPS[G.mapTier];

  // Fresh spots for the new map layout
  G.spots = G.currentMap.spots.map(s => ({...s, tower: null}));

  const bonusGold  = 100 + G.wave * 5;
  const bonusLives = 2;
  G.gold  += refund + bonusGold;
  G.lives  = Math.min(20, G.lives + bonusLives);

  const bonus = { gold: refund + bonusGold, lives: bonusLives };
  G.mapBanner = true;
  G.mapBannerBonus = bonus;

  // Auto-hide banner after 5s
  setTimeout(() => { G.mapBanner = false; }, 5000);

  addFloat(320, 220, `🗺 ${G.currentMap.label}!`, "#ffcc00");
  addFloat(320, 250, `+${bonus.gold}g  +${bonus.lives} lives`, "#88ff88");

  G.selTower = null; G.selSpot = null; G.placing = null;
  G.movingTower = null;
  document.querySelectorAll(".tbtn").forEach(b => b.classList.remove("active"));
  showMsg(`🗺 MAP: ${G.currentMap.label} — All towers refunded! +${bonus.gold}g +${bonus.lives} lives`, 7);
  syncDom(); updateInfo();
}

// ─── UI event listeners ───────────────────────────────────────────────────
document.querySelectorAll(".tbtn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (G.state !== "playing") return;
    const type = btn.dataset.type;
    const d    = TOWER_TYPES[type];

    if (d.minWave && G.wave < d.minWave) { showMsg(`${d.name} unlocks at Wave ${d.minWave}!`); return; }
    G.placing  = type;
    G.selTower = null;
    G.selSpot  = null;
    G.movingTower = null;
    document.querySelectorAll(".tbtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    showMsg(`Click a green ■ to place ${d.name} (${d.cost}g)`);
    updateInfo();
  });
});

el.startBtn.addEventListener("click", () => {
  if (G.state === "playing" && !G.waveOn) { G.mapBanner = false; startWave(); }
});

el.upgBtn.addEventListener("click", () => {
  const t = G.selTower; if (!t) return;
  const uc = t.upgradeCost();
  if (uc === null) { showMsg("Already at max level 999!"); return; }
  if (G.gold < uc) { showMsg(`Need ${uc}g — you have ${G.gold}g`); return; }
  G.gold -= uc; t.doUpgrade();
  showMsg(`${t.name} → Level ${t.level}!`);
  updateInfo(); syncDom();
});

el.sellBtn.addEventListener("click", () => {
  const t = G.selTower; if (!t) return;
  const v = t.sellValue();
  G.gold += v;
  const sp = G.spots.find(s => s.id === t.spotId);
  if (sp) sp.tower = null;
  G.selTower = null; G.selSpot = null;
  showMsg(`Sold for ${v}g`); updateInfo(); syncDom();
});

el.moveBtn.addEventListener("click", () => {
  const t = G.selTower;
  if (!t || G.waveOn) return;
  // Pick up the tower: remove it from its spot
  const sp = G.spots.find(s => s.id === t.spotId);
  G.movingOrigSpot = t.spotId;
  if (sp) sp.tower = null;
  G.movingTower = t;
  G.selTower    = null;
  G.selSpot     = null;
  document.querySelectorAll(".tbtn").forEach(b => b.classList.remove("active"));
  showMsg(`📦 Click a blue ■ to relocate ${t.name} (free)`);
  updateInfo();
});

el.cancelBtn.addEventListener("click", () => {
  if (!G.movingTower) return;
  // Put tower back in its original spot
  const origSpot = G.spots.find(s => s.id === G.movingOrigSpot);
  if (origSpot && !origSpot.tower) {
    origSpot.tower = G.movingTower;
    G.movingTower.spotId = origSpot.id;
    G.movingTower.cx = origSpot.cx;
    G.movingTower.cy = origSpot.cy;
    G.selTower = G.movingTower;
  }
  G.movingTower = null;
  showMsg("Move cancelled."); updateInfo();
});

el.ovBtn.addEventListener("click", () => { el.overlay.style.display = "none"; initGame(); });

// ESC cancels move mode
window.addEventListener("keydown", e => {
  if (e.key === "Escape" && G.movingTower) { el.cancelBtn.click(); }
});

// ─── Canvas coordinate helpers ────────────────────────────────────────────
function clientToCanvas(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    mx: (clientX - r.left) * (CVW / r.width),
    my: (clientY - r.top)  * (CVH / r.height),
  };
}

// ─── Core canvas interaction logic (shared by mouse & touch) ─────────────
function canvasClickAt(mx, my) {
  if (G.state === "title") { initGame(); return; }
  if (G.state !== "playing") return;

  for (const s of G.spots) {
    if (Math.abs(mx - s.cx) > SPOT_R || Math.abs(my - s.cy) > SPOT_R) continue;
    if (isSpotBlocked(s.cx, s.cy)) continue;   // blocked spots are non-interactive

    if (G.movingTower) {
      if (!s.tower) {
        s.tower = G.movingTower;
        G.movingTower.cx = s.cx; G.movingTower.cy = s.cy;
        G.movingTower.spotId = s.id;
        for (const sol of G.movingTower.soldiers) { sol.homeX = s.cx; sol.homeY = s.cy; }
        G.selTower = G.movingTower;
        G.movingTower = null;
        showMsg("Tower relocated!"); updateInfo(); scrollToInfo(); return;
      }
      showMsg("That spot is occupied!"); return;
    }

    if (s.tower) {
      G.selTower = s.tower; G.selSpot = s.id; G.placing = null;
      document.querySelectorAll(".tbtn").forEach(b => b.classList.remove("active"));
      updateInfo(); scrollToInfo(); return;
    }

    if (G.placing) {
      const d = TOWER_TYPES[G.placing];
      if (d.minWave && G.wave < d.minWave) { showMsg(`Unlocks at Wave ${d.minWave}!`); return; }
      if (G.gold < d.cost) { showMsg("Not enough gold!"); return; }
      G.gold -= d.cost;
      const t = new Tower(G.placing, s.cx, s.cy, s.id);
      s.tower = t; G.selTower = t; G.selSpot = s.id;
      document.querySelectorAll(".tbtn").forEach(b => b.classList.remove("active"));
      G.placing = null;
      addFloat(s.cx, s.cy - 24, `-${d.cost}g`, "#ff8800");
      showMsg(`${t.name} placed!`); updateInfo(); syncDom(); return;
    }

    G.selSpot = s.id; G.selTower = null; updateInfo(); return;
  }

  if (G.movingTower) { showMsg("Tap a blue ■ to place (ESC/button to cancel)"); return; }
  G.selSpot = null; G.selTower = null; G.placing = null;
  document.querySelectorAll(".tbtn").forEach(b => b.classList.remove("active"));
  updateInfo();
}

// On mobile, scroll the info panel into view after selecting a tower
function scrollToInfo() {
  if (isMobile()) {
    const infoEl = document.getElementById("info-content");
    if (infoEl) infoEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// ─── Mouse events ─────────────────────────────────────────────────────────
canvas.addEventListener("mousemove", e => {
  const { mx, my } = clientToCanvas(e.clientX, e.clientY);
  G.mouseX = mx; G.mouseY = my;
  if (G.state !== "playing") return;
  let hov = false;
  for (const s of G.spots) {
    if (!s.tower && !isSpotBlocked(s.cx,s.cy) && Math.abs(mx - s.cx) <= SPOT_R && Math.abs(my - s.cy) <= SPOT_R) { hov = true; break; }
  }
  canvas.style.cursor = (hov || G.placing || G.movingTower) ? "pointer" : "default";
});

canvas.addEventListener("click", e => {
  const { mx, my } = clientToCanvas(e.clientX, e.clientY);
  canvasClickAt(mx, my);
});

// ─── Touch events (mobile) ────────────────────────────────────────────────
canvas.addEventListener("touchstart", e => {
  e.preventDefault(); // prevent scroll / double-tap zoom
  if (e.touches.length === 0) return;
  const { mx, my } = clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
  G.mouseX = mx; G.mouseY = my;
}, { passive: false });

canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  if (e.touches.length === 0) return;
  const { mx, my } = clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
  G.mouseX = mx; G.mouseY = my;
  // Update hover cursor feedback
  let hov = false;
  for (const s of G.spots) {
    if (!s.tower && !isSpotBlocked(s.cx,s.cy) && Math.abs(mx - s.cx) <= SPOT_R && Math.abs(my - s.cy) <= SPOT_R) { hov = true; break; }
  }
  canvas.style.cursor = (hov || G.placing || G.movingTower) ? "pointer" : "default";
}, { passive: false });

canvas.addEventListener("touchend", e => {
  e.preventDefault();
  if (e.changedTouches.length === 0) return;
  const { mx, my } = clientToCanvas(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  canvasClickAt(mx, my);
}, { passive: false });

// ─── Wave management ──────────────────────────────────────────────────────
function startWave() {
  G.wave++; G.waveOn = true;
  G.eMod = { speed:1, hp:1, reward:1 };
  G.tMod = { rate:1, range:1, cannonDmg:1, dmgMult:1, poisonMult:1 };

  if (G.wave % 5 === 0) {
    const ev = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    ev.fn(G);
    el.evtBox.style.display = "block";
    el.evtTxt.textContent   = ev.eff;
    showMsg(`${ev.text}  —  ${ev.eff}`, 6);
    setTimeout(() => el.evtBox.style.display = "none", 7000);
  }

  G.spawnQ = generateWave(G.wave, G.currentMap.paths.length);
  G.spawnT = G.spawnQ.length ? G.spawnQ[0].wait : 999;
  el.startBtn.disabled = true;
  const isBossWave = G.wave % 5 === 0;
  const isDualRoad = G.currentMap.paths.length > 1;
  showMsg(`⚔ Wave ${G.wave}!${isBossWave ? " 👑 BOSS!" : ""}${isDualRoad ? " ⚠ Dual roads!" : ""}`, 3);
  syncDom();
}

function onWaveEnd() {
  G.waveOn = false;
  const bonus = G.wave * 15 + 20;
  G.gold  += bonus;
  G.score += G.wave * 100;
  if (G.wave > G.best) { G.best = G.wave; localStorage.setItem("vtd_best", G.best); }
  el.startBtn.disabled = false;

  // Every 10 waves: change map + bonus
  if (G.wave % 10 === 0) {
    switchMap();
  } else {
    showMsg(`✓ Wave ${G.wave} cleared!  +${bonus}g`, 4);
  }
  syncDom(); updateInfo();
}

function loseLife(n = 1) {
  G.lives -= n;
  if (G.lives <= 0) { G.lives = 0; gameOver(); }
  syncDom();
}

function gameOver() {
  G.state = "gameover";
  el.ovTitle.textContent = "Village Overrun!";
  el.ovBody.innerHTML = `Survived <b>${G.wave}</b> waves!<br>Score: <b>${G.score}</b><br>Best: <b>${G.best}</b> waves<br>Maps cleared: <b>${G.mapTier}</b>`;
  el.overlay.style.display = "flex";
}

// ─── Game init ────────────────────────────────────────────────────────────
function initGame() {
  G.state = "playing"; G.gold = 150; G.lives = 10; G.wave = 0; G.score = 0;
  G.enemies = []; G.projs = []; G.parts = []; G.floats = [];
  G.selSpot = null; G.selTower = null; G.placing = null;
  G.movingTower = null; G.movingOrigSpot = null;
  G.waveOn = false; G.spawnQ = []; G.spawnT = 0;
  G.mapTier = 0; G.currentMap = MAPS[0]; G.mapBanner = false;
  G.spots = G.currentMap.spots.map(s => ({...s, tower: null}));
  G.eMod = {speed:1,hp:1,reward:1};
  G.tMod = {rate:1,range:1,cannonDmg:1,dmgMult:1,poisonMult:1};
  el.startBtn.disabled = false;
  el.overlay.style.display  = "none";
  el.evtBox.style.display   = "none";
  document.querySelectorAll(".tbtn").forEach(b => b.classList.remove("active"));
  syncDom(); updateInfo();
  showMsg("Place towers on green ■ spots → START WAVE!  (Map changes every 10 waves)", 8);
}

// ─── Update ───────────────────────────────────────────────────────────────
function update(dt) {
  // Spawn enemies
  if (G.waveOn && G.spawnQ.length > 0) {
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      const item = G.spawnQ.shift();
      const pathArr = G.currentMap.paths[item.pathIdx || 0];
      G.enemies.push(new Enemy(item.type, G.wave, G.eMod, pathArr));
      G.spawnT = G.spawnQ.length ? G.spawnQ[0].wait : 999;
    }
  }

  const towers = allTowers();

  // Axe buff pre-pass
  for (const t of towers) t.buffed = false;
  for (const t of towers) {
    if (t.type !== "axe") continue;
    const rng = t.range * (G.tMod.range || 1);
    for (const other of towers) {
      if (other !== t && Math.hypot(other.cx - t.cx, other.cy - t.cy) <= rng) other.buffed = true;
    }
  }

  // Update enemies
  for (const e of G.enemies) {
    e.update(dt);
    if (e.dead) {
      const goldGain = Math.floor(e.reward * e.goldenMod);
      G.gold  += goldGain; G.score += goldGain * 3;
      addParticles(e.x, e.y, e.color, e.isBoss ? 40 : 14);
      addFloat(e.x, e.y - 22, `+${goldGain}g`, e.isBoss ? "#ffdd00" : "#ffee00");
      if (e.isBoss) addFloat(e.x, e.y - 44, "BOSS DOWN!", "#ff4444");
      for (const t of towers) if (t.target === e) t.target = null;
      syncDom();
    } else if (e.escaped) {
      loseLife(e.isBoss ? 3 : 1);
      addFloat(320, 20, e.isBoss ? "☠ BOSS ESCAPED! -3" : "Enemy escaped!", "#ff4444");
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead && !e.escaped);

  for (const t of towers) t.update(dt, G.enemies, G.projs, G.tMod);

  for (const p of G.projs) p.update(dt);
  G.projs = G.projs.filter(p => !p.dead);

  for (const p of G.parts)  p.update(dt); G.parts  = G.parts.filter(p  => !p.dead);
  for (const f of G.floats) f.update(dt); G.floats = G.floats.filter(f => !f.dead);

  if (G.waveOn && G.spawnQ.length === 0 && G.enemies.length === 0) onWaveEnd();
}

// ─── Render ───────────────────────────────────────────────────────────────
function render() {
  drawBackground(ctx);
  drawBuildSpots(ctx, G.spots, G.selSpot, !!G.movingTower);

  const towers = allTowers();
  if (G.selTower) drawRange(ctx, G.selTower, G.tMod);

  for (const t of towers) {
    drawTower(ctx, t);
    if (t.type === "spawner") t.soldiers.forEach(s => drawSoldier(ctx, s));
  }

  [...G.enemies].sort((a, b) => a.y - b.y).forEach(e => drawEnemy(ctx, e));
  G.projs.forEach(p  => drawProjectile(ctx, p));
  G.parts.forEach(p  => drawParticle(ctx, p));
  G.floats.forEach(f => drawFloat(ctx, f));

  // Floating tower follows mouse during relocation
  if (G.movingTower) drawMovingTower(ctx, G.movingTower, G.mouseX, G.mouseY);

  // Map-change banner
  if (G.mapBanner) drawMapChangeBanner(ctx, G.currentMap.label, G.currentMap.id, G.mapBannerBonus);

  if (G.state === "title") drawTitle(ctx);
}

// ─── Game loop ────────────────────────────────────────────────────────────
let lastT = 0;
function loop(now) {
  const dt = Math.min(0.04, (now - lastT) / 1000);
  lastT = now;
  if (G.state === "playing") update(dt);
  render();
  requestAnimationFrame(loop);
}

// ─── Boot ─────────────────────────────────────────────────────────────────
syncDom();
updateInfo();
requestAnimationFrame(loop);
