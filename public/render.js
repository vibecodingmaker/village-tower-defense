"use strict";
// ─── Tiny helpers ─────────────────────────────────────────────────────────
const $r = (ctx,x,y,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(x|0,y|0,w|0,h|0); };
const $shade = (hex,a)=>{
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,Math.max(0,r+a))},${Math.min(255,Math.max(0,g+a))},${Math.min(255,Math.max(0,b+a))})`;
};

// ─── Background / map ─────────────────────────────────────────────────────
function drawBackground(ctx) {
  const now = performance.now() * 0.001;
  const paths = (typeof G !== "undefined" && G.currentMap) ? G.currentMap.paths : MAPS[0].paths;

  // ── 1. Draw grass grid tiles ─────────────────────────────────────────────
  // Precompute which tiles are "road" so we can skip the grass fill for them
  const roadSet = new Set();
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const ax = path[i].x, ay = path[i].y, bx = path[i+1].x, by = path[i+1].y;
      // scan a bounding box of tiles around this segment
      const minC = Math.max(0, Math.floor((Math.min(ax,bx) - ROAD_W) / TILE));
      const maxC = Math.min(GRID_COLS-1, Math.ceil((Math.max(ax,bx) + ROAD_W) / TILE));
      const minR = Math.max(0, Math.floor((Math.min(ay,by) - ROAD_W) / TILE));
      const maxR = Math.min(GRID_ROWS-1, Math.ceil((Math.max(ay,by) + ROAD_W) / TILE));
      for (let row = minR; row <= maxR; row++) {
        for (let col = minC; col <= maxC; col++) {
          const cx = col * TILE + TILE/2, cy = row * TILE + TILE/2;
          if (ptSegDist(cx, cy, ax, ay, bx, by) < ROAD_W / 2 + TILE * 0.6)
            roadSet.add(row * GRID_COLS + col);
        }
      }
    }
  }

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const tx = col * TILE, ty = row * TILE;
      if (roadSet.has(row * GRID_COLS + col)) continue;  // road drawn later
      // Alternating light/dark grass for subtle checkerboard
      const even = (col + row) % 2 === 0;
      $r(ctx, tx, ty, TILE, TILE, even ? "#52943a" : "#4d8c36");
      $r(ctx, tx+1, ty+1, TILE-2, TILE-2, even ? "#5aa040" : "#559939");
      // Subtle cross marker (like reference image)
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = "#000000";
      ctx.fillRect(tx + TILE/2 - 1, ty + 4, 2, TILE - 8);
      ctx.fillRect(tx + 4, ty + TILE/2 - 1, TILE - 8, 2);
      ctx.globalAlpha = 1;
    }
  }

  // ── 2. Draw road tiles ────────────────────────────────────────────────────
  for (const key of roadSet) {
    const col = key % GRID_COLS, row = (key / GRID_COLS) | 0;
    const tx = col * TILE, ty = row * TILE;
    $r(ctx, tx, ty, TILE, TILE, "#b8845a");
    $r(ctx, tx+1, ty+1, TILE-2, TILE-2, "#c8956c");
    // subtle gravel dot
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#7a5010";
    ctx.fillRect(tx + TILE/2 - 2, ty + TILE/2 - 1, 4, 3);
    ctx.globalAlpha = 1;
  }

  // ── 3. Road centre-line detail (thin line for path clarity) ──────────────
  paths.forEach((p, i) => _roadDetail(ctx, p, i));

  // ── 4. Static map objects ─────────────────────────────────────────────────
  // Lake (drawn after road tiles so it covers the top-left corner cleanly)
  $r(ctx,10,10,122,98,"#1a5a9a"); $r(ctx,12,12,118,94,"#2a7acd");
  for (let i=0; i<4; i++) {
    const sx=22+i*22+Math.sin(now*0.9+i*1.2)*4;
    $r(ctx,sx|0,38+i*12,14,2,"#5599ee");
  }
  ctx.fillStyle="#1a4a7a"; ctx.font="7px monospace"; ctx.fillText("~ LAKE ~",30,62);

  _building(ctx,522,18,90,74,"INN","#7a4a18","#cc3333");
  _building(ctx,508,328,102,82,"PUB","#6a3a10","#aa2222");
  _watchtower(ctx,10,10,28,86);
  _well(ctx,374,374);
  BG_TREES.forEach(([x,y])=>_tree(ctx,x,y));

  // ── 5. Canvas border stones ───────────────────────────────────────────────
  for (const wx of [0, CVW-8]) {
    $r(ctx, wx, 0, 8, CVH, "#777");
    for (let y=0; y<CVH; y+=20) $r(ctx, wx, y, 8, 12, "#aaa");
  }
  $r(ctx,0,0,302,8,"#777"); $r(ctx,338,0,CVW-338,8,"#777");
  for (let x=0; x<302; x+=20) $r(ctx,x,0,12,8,"#aaa");
  for (let x=338; x<CVW; x+=20) $r(ctx,x,0,12,8,"#aaa");
  $r(ctx,0,CVH-8,302,8,"#777"); $r(ctx,338,CVH-8,CVW-338,8,"#777");
  for (let x=0; x<302; x+=20) $r(ctx,x,CVH-8,12,8,"#aaa");
  for (let x=338; x<CVW; x+=20) $r(ctx,x,CVH-8,12,8,"#aaa");

  // ── 6. Map label ──────────────────────────────────────────────────────────
  if (typeof G !== "undefined" && G.currentMap) {
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(10, CVH-22, 160, 16);
    ctx.fillStyle = "#aaccff"; ctx.font = "7px monospace";
    ctx.fillText(`🗺 ${G.currentMap.label}  (Map ${G.currentMap.id + 1}/5)`, 14, CVH-10);
  }
}

// Thin centre-line detail drawn on top of road tiles (replaces the old thick drawRoad)
function _roadDetail(ctx, pathArr, roadIdx) {
  if (!pathArr || pathArr.length < 2) return;
  const col = roadIdx === 1 ? "rgba(90,48,0,0.35)" : "rgba(74,40,0,0.35)";
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 4;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.setLineDash([8, 12]);
  ctx.beginPath();
  ctx.moveTo(pathArr[0].x, pathArr[0].y);
  pathArr.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}


function _building(ctx,x,y,w,h,label,wall,roof) {
  const wy=y+(h*0.34)|0;
  $r(ctx,x,wy,w,h*0.66,wall);
  ctx.fillStyle=$shade(wall,-18);
  for (let oy=wy+8; oy<y+h; oy+=12) ctx.fillRect(x,oy,w,2);
  ctx.fillStyle=roof;
  ctx.beginPath(); ctx.moveTo(x-5,wy+2); ctx.lineTo(x+w/2,y+2); ctx.lineTo(x+w+5,wy+2); ctx.closePath(); ctx.fill();
  $r(ctx,x,wy-2,w,6,$shade(roof,-28));
  $r(ctx,x+w-22,y+4,8,wy-y-2,"#666"); $r(ctx,x+w-24,y+2,12,4,"#444");
  $r(ctx,x+8,y+h*0.42,12,10,"#ffeeaa"); $r(ctx,x+w-22,y+h*0.42,12,10,"#ffeeaa");
  ctx.fillStyle="#885500";
  ctx.fillRect(x+14,y+h*0.42,1,10); ctx.fillRect(x+8,y+h*0.47,12,1);
  ctx.fillRect(x+w-16,y+h*0.42,1,10); ctx.fillRect(x+w-22,y+h*0.47,12,1);
  $r(ctx,x+w/2-8,y+h*0.66,16,h*0.34+2,"#4a2800"); $r(ctx,x+w/2-6,y+h*0.68,12,h*0.32,"#6a3800");
  $r(ctx,x+w/2-18,y+h*0.46,36,12,"#cc9900");
  ctx.fillStyle="#220000"; ctx.font="7px monospace"; ctx.textAlign="center";
  ctx.fillText(label,x+w/2,y+h*0.46+9); ctx.textAlign="left";
}
function _watchtower(ctx,x,y,w,h) {
  $r(ctx,x,y+h*0.3,w,h*0.7,"#777"); $r(ctx,x+2,y+h*0.3+2,w-4,h*0.68,"#999");
  $r(ctx,x+w/2-2,y+h*0.5,4,8,"#333"); $r(ctx,x-3,y+h*0.28,w+6,h*0.06,"#888");
  for (let i=0;i<3;i++) $r(ctx,x+i*(w/2)-2,y+h*0.22,w/3,h*0.08,"#bbb");
}
function _well(ctx,x,y) {
  $r(ctx,x-14,y-4,28,16,"#888"); $r(ctx,x-12,y-2,24,12,"#aaa");
  $r(ctx,x-10,y,20,8,"#2a7acd");
  $r(ctx,x-12,y-16,3,14,"#5a3d1a"); $r(ctx,x+9,y-16,3,14,"#5a3d1a");
  $r(ctx,x-14,y-18,28,4,"#7a5a2a"); $r(ctx,x-1,y-16,2,10,"#aa8844");
}
function _tree(ctx,x,y) {
  $r(ctx,x-3,y-6,6,10,"#5a3d1a"); $r(ctx,x-13,y-22,26,18,"#2d8b2d");
  $r(ctx,x-10,y-32,20,14,"#3aaa3a"); $r(ctx,x-7,y-40,14,12,"#22772a");
  $r(ctx,x-8,y-30,6,4,"#55cc55"); $r(ctx,x-4,y-36,4,4,"#55cc55");
}

// ─── Build spots (grid-cell style, matching the reference image) ──────────
function drawBuildSpots(ctx, spots, selId, moveMode) {
  for (const s of spots) {
    if (s.tower) continue;
    if (isSpotBlocked(s.cx, s.cy)) continue;
    const hov = s.id === selId;

    // Snap to tile top-left corner
    const tx = Math.floor(s.cx / TILE) * TILE;
    const ty = Math.floor(s.cy / TILE) * TILE;
    const cx = tx + TILE / 2;
    const cy = ty + TILE / 2;

    if (hov) {
      // Highlighted tile (selected or hover)
      ctx.globalAlpha = 0.88;
      $r(ctx, tx, ty, TILE, TILE, moveMode ? "#6699ff" : "#77ee99");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = moveMode ? "#3366ff" : "#00cc55";
      ctx.lineWidth = 3;
      ctx.strokeRect(tx + 1.5, ty + 1.5, TILE - 3, TILE - 3);
    } else {
      // Normal empty build slot — white semi-transparent square (reference image style)
      ctx.globalAlpha = 0.62;
      $r(ctx, tx, ty, TILE, TILE, "#ffffff");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(tx + 1, ty + 1, TILE - 2, TILE - 2);
    }

    // + icon centred in tile
    const arm = 7;
    const ic = hov ? (moveMode ? "#2255dd" : "#007733") : "rgba(180,220,180,0.95)";
    $r(ctx, cx - 1, cy - arm, 2, arm * 2, ic);
    $r(ctx, cx - arm, cy - 1, arm * 2, 2, ic);
  }
}

// Draw the "floating" tower being moved (follows mouse via G.mouseX/Y)
function drawMovingTower(ctx, tower, mx, my) {
  if (!tower) return;
  ctx.globalAlpha = 0.72;
  ctx.save();
  ctx.translate(mx - tower.cx + tower.cx, my - tower.cy + tower.cy);
  drawTower(ctx, { ...tower, cx: mx, cy: my, flash: 0 });
  ctx.restore();
  ctx.globalAlpha = 1;
  // Label
  ctx.fillStyle = "#00ccff"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center";
  ctx.fillText(`📦 ${tower.name}`, mx, my - 30);
  ctx.textAlign = "left";
}

// ─── Tower drawing ────────────────────────────────────────────────────────
function drawTower(ctx, t) {
  const {cx,cy,level,flash,buffed} = t;

  // Axe-buffed glow ring
  if (buffed) {
    ctx.globalAlpha=0.25; ctx.fillStyle="#ffcc44";
    ctx.beginPath(); ctx.arc(cx,cy,20,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }

  $r(ctx,cx-15,cy+2,30,10,"#777"); $r(ctx,cx-13,cy,26,8,"#999");

  const fn = {
    cannon:      _cannon,   archer:     _archer,     spawner:   _barracks,
    prototype:   _prototype,peacemaker: _peacemaker,  bonecrusher:_bonecrusher,
    poison:      _poisontower,missiles: _missiles,    dagger:    _dagger,
    golden:      _golden,   blackhole:  _blackhole,   chrono:    _chrono,
    axe:         _axetower,
  }[t.type];
  if (fn) fn(ctx, cx, cy, level, flash, t);

  // Level badge (number instead of pip dots for 999-level system)
  if (level > 0) {
    ctx.fillStyle = level >= 100 ? "#ff4400" : level >= 50 ? "#ff8800" :
                    level >= 20  ? "#ffcc00" : "#88ff88";
    ctx.font = "bold 7px monospace"; ctx.textAlign = "center";
    ctx.fillText(`Lv${level}`, cx, cy + 14);
    ctx.textAlign = "left";
  }
}

// ── Classic ────────────────────────────────────────────────────────────────
function _cannon(ctx,cx,cy,lv,fl) {
  $r(ctx,cx-12,cy-24,24,26,"#778899"); $r(ctx,cx-10,cy-22,20,22,"#889aaa");
  for(let i=-1;i<=1;i++) $r(ctx,cx+i*8-3,cy-30,6,8,"#6a7a8a");
  $r(ctx,cx,cy-18,18,7,"#444"); $r(ctx,cx+14,cy-19,8,9,"#333");
  if(fl>0){ $r(ctx,cx+20,cy-20,10,11,"#ffaa00"); $r(ctx,cx+23,cy-18,5,7,"#ffff00"); }
}
function _archer(ctx,cx,cy,lv,fl) {
  $r(ctx,cx-10,cy-28,20,30,"#7a5020"); $r(ctx,cx-8,cy-26,16,26,"#9a6830");
  $r(ctx,cx-2,cy-22,4,12,"#332200");
  $r(ctx,cx-3,cy-34,6,7,"#ddbb88"); $r(ctx,cx-4,cy-28,8,6,"#448844");
  $r(ctx,cx+4,cy-32,2,8,"#8B4513");
  if(fl>0) $r(ctx,cx+6,cy-30,10,2,"#ffcc00");
  for(let i=0;i<3;i++) $r(ctx,cx-8+i*7,cy-32,5,6,"#6a4018");
}
function _barracks(ctx,cx,cy,lv,fl) {
  $r(ctx,cx-15,cy-22,30,24,"#334499"); $r(ctx,cx-13,cy-20,26,20,"#4455aa");
  $r(ctx,cx-5,cy-12,10,14,"#223388"); $r(ctx,cx-4,cy-10,8,12,"#334499");
  $r(ctx,cx-1,cy-32,2,12,"#555");
  const fw=(Math.sin(performance.now()*0.004)*2)|0;
  $r(ctx,cx+1,cy-32,10+fw,7,"#cc2200");
  if(fl>0){ $r(ctx,cx-14,cy-20,4,4,"#ff8800"); $r(ctx,cx+10,cy-20,4,4,"#ff8800"); }
}

// ── Ranged / Mechanical ─────────────────────────────────────────────────────
function _prototype(ctx,cx,cy,lv,fl) {
  // Sci-fi pylon with energy core
  $r(ctx,cx-8,cy-30,16,32,"#223344"); $r(ctx,cx-6,cy-28,12,28,"#334455");
  $r(ctx,cx-4,cy-18,8,8,"#00ffcc"); // energy core
  $r(ctx,cx-3,cy-17,6,6,"#ffffff");
  for(let i=0;i<3;i++) $r(ctx,cx-3+i*3,cy-32,2,4,"#00aacc"); // antenna array
  if(fl>0){
    ctx.globalAlpha=0.7; $r(ctx,cx-1,cy-22,2,50,"#00ffcc"); ctx.globalAlpha=1; // beam
    $r(ctx,cx-4,cy-20,8,4,"#ffffff");
  }
}
function _peacemaker(ctx,cx,cy,lv,fl) {
  // Industrial minigun barrel cluster
  $r(ctx,cx-12,cy-26,24,28,"#664422"); $r(ctx,cx-10,cy-24,20,24,"#886633");
  for(let i=0;i<3;i++) $r(ctx,cx-6+i*4,cy-30,3,10,"#444"); // barrels
  $r(ctx,cx-8,cy-28,16,4,"#cc6600"); // heat band
  if(fl>0){
    $r(ctx,cx+8,cy-22,12,4,"#ff8800"); $r(ctx,cx+14,cy-21,6,3,"#ffff00");
    $r(ctx,cx+6,cy-24,8,3,"#ffaa00");
  }
}
function _bonecrusher(ctx,cx,cy,lv,fl) {
  // Bulky stone-fist siege tower
  $r(ctx,cx-14,cy-26,28,28,"#886644"); $r(ctx,cx-12,cy-24,24,24,"#aa8855");
  $r(ctx,cx-16,cy-30,8,10,"#997755"); $r(ctx,cx+8,cy-30,8,10,"#997755"); // side spikes
  $r(ctx,cx-6,cy-20,12,12,"#554422"); // impact plate
  if(fl>0){
    ctx.globalAlpha=0.6;
    $r(ctx,cx-18,cy-26,10,10,"#ffffff"); $r(ctx,cx+8,cy-26,10,10,"#ffffff");
    ctx.globalAlpha=1;
  }
}
function _poisontower(ctx,cx,cy,lv,fl) {
  // Twisted vine / alchemist tower
  $r(ctx,cx-9,cy-28,18,30,"#224422"); $r(ctx,cx-7,cy-26,14,26,"#335533");
  $r(ctx,cx-10,cy-30,20,4,"#226622"); // cap
  ctx.fillStyle="#44cc22";
  ctx.beginPath(); ctx.arc(cx,cy-20,5,0,Math.PI*2); ctx.fill(); // poison bulb
  ctx.fillStyle="#22aa00";
  ctx.beginPath(); ctx.arc(cx,cy-20,3,0,Math.PI*2); ctx.fill();
  if(fl>0){
    ctx.globalAlpha=0.5; $r(ctx,cx-2,cy-24,4,30,"#44cc22"); ctx.globalAlpha=1;
  }
}
function _missiles(ctx,cx,cy,lv,fl) {
  // 3-tube missile launcher
  $r(ctx,cx-14,cy-24,28,26,"#553322"); $r(ctx,cx-12,cy-22,24,22,"#774433");
  for(let i=0;i<3;i++){
    $r(ctx,cx-10+i*9,cy-30,6,14,"#444"); // tubes
    $r(ctx,cx-9+i*9,cy-32,4,4,"#cc2200"); // warheads
  }
  if(fl>0){
    for(let i=0;i<3;i++){ $r(ctx,cx-8+i*9,cy-30,3,6,"#ff4400"); $r(ctx,cx-7+i*9,cy-28,2,4,"#ffcc00"); }
  }
}
function _dagger(ctx,cx,cy,lv,fl) {
  // Twin spinning blades on a short post
  $r(ctx,cx-3,cy-24,6,26,"#666"); $r(ctx,cx-2,cy-22,4,22,"#888");
  const a = performance.now() * 0.008;
  ctx.save(); ctx.translate(cx, cy-18);
  ctx.rotate(a);
  $r(ctx,-10,-2,20,4,"#cc44cc"); $r(ctx,-2,-10,4,20,"#cc44cc");
  ctx.restore();
  ctx.save(); ctx.translate(cx, cy-10);
  ctx.rotate(-a * 1.3);
  $r(ctx,-8,-2,16,4,"#ff88ff"); $r(ctx,-2,-8,4,16,"#ff88ff");
  ctx.restore();
  if(fl>0) { ctx.globalAlpha=0.4; $r(ctx,cx-14,cy-26,28,26,"#ff88ff"); ctx.globalAlpha=1; }
}

// ── Aura / Special ──────────────────────────────────────────────────────────
function _golden(ctx,cx,cy,lv,fl,t) {
  // Golden pillar with coin shower
  $r(ctx,cx-10,cy-28,20,30,"#886600"); $r(ctx,cx-8,cy-26,16,26,"#ccaa00");
  $r(ctx,cx-12,cy-30,24,5,"#ffdd00");
  const p=performance.now()*0.002;
  for(let i=0;i<4;i++){
    const oy=(p*30+i*15)%36|0;
    ctx.fillStyle=`rgba(255,220,0,${0.8-oy/40})`;
    ctx.fillRect(cx-4+i*3, (cy-28+oy)|0, 4, 4);
  }
  ctx.globalAlpha=0.15+(Math.sin(p)*0.08);
  ctx.fillStyle="#ffdd00";
  ctx.beginPath(); ctx.arc(cx,cy,t.range*(1),0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}
function _blackhole(ctx,cx,cy,lv,fl,t) {
  // Swirling dark vortex
  const p=performance.now()*0.003;
  ctx.globalAlpha=0.20+Math.abs(Math.sin(p))*0.15;
  ctx.fillStyle="#6600cc";
  ctx.beginPath(); ctx.arc(cx,cy,t.range,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
  $r(ctx,cx-8,cy-8,16,16,"#220033");
  ctx.strokeStyle="#aa00ff"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(cx,cy,10+Math.sin(p*3)*3,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2);
  ctx.fillStyle="#000000"; ctx.fill();
  if(fl>0){ ctx.globalAlpha=0.5; $r(ctx,cx-12,cy-12,24,24,"#cc00ff"); ctx.globalAlpha=1; }
}
function _chrono(ctx,cx,cy,lv,fl,t) {
  // Blue clockwork tower
  $r(ctx,cx-10,cy-28,20,30,"#003366"); $r(ctx,cx-8,cy-26,16,26,"#0055aa");
  $r(ctx,cx-12,cy-30,24,5,"#0077cc");
  const p=performance.now()*0.001;
  ctx.strokeStyle="#88ccff"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(cx,cy-18,7,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy-18);
  ctx.lineTo(cx+Math.cos(p*2)*5, cy-18+Math.sin(p*2)*5); ctx.stroke(); // minute hand
  ctx.beginPath(); ctx.moveTo(cx,cy-18);
  ctx.lineTo(cx+Math.cos(p*12)*3, cy-18+Math.sin(p*12)*3); ctx.stroke();
  ctx.globalAlpha=0.12; ctx.fillStyle="#00aaff";
  ctx.beginPath(); ctx.arc(cx,cy,t.range,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}
function _axetower(ctx,cx,cy,lv,fl,t) {
  // Wooden stump with a spinning axe
  $r(ctx,cx-8,cy-20,16,22,"#8B4513"); $r(ctx,cx-6,cy-18,12,18,"#a0522d");
  const a=performance.now()*0.004;
  ctx.save(); ctx.translate(cx,cy-22); ctx.rotate(a);
  ctx.fillStyle="#8B4513"; ctx.fillRect(-2,-8,4,16);
  ctx.fillStyle="#aaaaaa"; ctx.fillRect(2,-8,6,6); ctx.fillRect(-8,-8,6,6);
  ctx.restore();
  ctx.globalAlpha=0.10; ctx.fillStyle="#ffcc44";
  ctx.beginPath(); ctx.arc(cx,cy,t.range,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}

// ─── Enemy drawing ────────────────────────────────────────────────────────
function drawEnemy(ctx, e) {
  if (e.dead || e.escaped) return;
  const flyY = e.flies ? -10 : 0;
  const bob  = (Math.sin(e.animT * 8) * 1.5) | 0;
  const ex   = (e.x + e.wobOff) | 0;
  const ey   = (e.y + flyY + bob) | 0;
  const s    = e.size;

  if (e.flies) {
    ctx.globalAlpha=0.22; $r(ctx,ex-s,e.y-3,s*2,5,"#000"); ctx.globalAlpha=1;
  }

  // Status effect tints (underneath the sprite)
  if (e.stunTime > 0) { ctx.globalAlpha=0.3; $r(ctx,ex-s,ey-s*2,s*2,s*3,"#ffff00"); ctx.globalAlpha=1; }
  if (e.poisonRem> 0) { ctx.globalAlpha=0.25;$r(ctx,ex-s,ey-s*2,s*2,s*3,"#44ff44"); ctx.globalAlpha=1; }
  if (e.slowFactor<0.9){ ctx.globalAlpha=0.20;$r(ctx,ex-s,ey-s*2,s*2,s*3,"#aaddff"); ctx.globalAlpha=1; }

  switch(e.type) {
    case "goblin":     _goblin(ctx,ex,ey,s,e.animT); break;
    case "skeleton":   _skeleton(ctx,ex,ey,s,e.animT); break;
    case "orc":        _orc(ctx,ex,ey,s,e.animT); break;
    case "troll":      _troll(ctx,ex,ey,s,e.animT); break;
    case "dragon":     _dragon(ctx,ex,ey,s,e.animT); break;
    case "ogre":       _ogre(ctx,ex,ey,s,e.animT); break;
    case "harpy":      _harpy(ctx,ex,ey,s,e.animT); break;
    case "necromancer":_necromancer(ctx,ex,ey,s,e.animT); break;
    case "demon":      _demon(ctx,ex,ey,s,e.animT); break;
    case "boss":       _boss(ctx,ex,ey,s,e.animT); break;
  }

  // Stun stars above head
  if (e.stunTime > 0) {
    for(let i=0;i<3;i++){
      const a=e.animT*6+i*2.1;
      const sx=ex+Math.cos(a)*8, sy=ey-s*2-12+Math.sin(a)*3;
      ctx.fillStyle="#ffff00"; ctx.font="8px monospace"; ctx.textAlign="center";
      ctx.fillText("★", sx|0, sy|0);
    }
    ctx.textAlign="left";
  }

  // HP bar
  const bW=s*2+4, bY=ey-s*2-10;
  $r(ctx,ex-bW/2,bY,bW,4,"#333");
  const pct=e.hp/e.maxHp;
  $r(ctx,ex-bW/2,bY,(bW*pct)|0,4,pct>0.5?"#44ff44":pct>0.25?"#ffaa00":"#ff2222");

  // Speech bubble
  if (e.speechT > 0) {
    const tw=e.speech.length*5+8, bx=(ex-tw/2)|0, by=bY-14;
    $r(ctx,bx,by,tw,11,"rgba(255,255,220,0.93)");
    ctx.fillStyle="#333"; ctx.font="7px monospace"; ctx.fillText(e.speech,bx+4,by+8);
  }
}

// ── Shared helpers for cartoonish enemy rendering ────────────────────────────
function _shadow(ctx,ex,ey,w) {
  ctx.globalAlpha=0.22; ctx.fillStyle="#000";
  ctx.beginPath(); ctx.ellipse(ex,ey+2,w*0.8,3,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}
function _circle(ctx,x,y,r,c){ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
function _eye(ctx,x,y,r,iris){ _circle(ctx,x,y,r,"#fff"); _circle(ctx,x,y,r*0.5,iris); _circle(ctx,x,y,r*0.2,"#111"); }

// ── Classic enemies ─────────────────────────────────────────────────────────
function _goblin(ctx,ex,ey,s,t) {
  const walk=(Math.sin(t*9)*3)|0;
  _shadow(ctx,ex,ey,s);
  // Body
  ctx.fillStyle="#2cb82c"; ctx.beginPath(); ctx.roundRect(ex-s+2,ey-s+2,s*2-4,s*2-2,4); ctx.fill();
  // Arms (swing)
  $r(ctx,ex-s-2,ey-s+4+walk,4,7,"#22aa22"); $r(ctx,ex+s-2,ey-s+4-walk,4,7,"#22aa22");
  // Legs
  $r(ctx,ex-s+4,ey+2,5,7,"#22aa22"); $r(ctx,ex+s-9,ey+2+Math.abs(walk)-2,5,7,"#22aa22");
  // Head (round)
  _circle(ctx,ex,ey-s*2+3,s*1.05,"#33cc33");
  // Ears
  _circle(ctx,ex-s+1,ey-s*2+2,s*0.45,"#22aa22");
  _circle(ctx,ex+s-1,ey-s*2+2,s*0.45,"#22aa22");
  // Eyes
  _eye(ctx,ex-3,ey-s*2+2,3,"#cc2200"); _eye(ctx,ex+3,ey-s*2+2,3,"#cc2200");
  // Mouth / teeth
  ctx.fillStyle="#111"; ctx.fillRect(ex-4,ey-s*2+7,8,3);
  ctx.fillStyle="#fff"; for(let i=0;i<3;i++) ctx.fillRect(ex-3+i*3,ey-s*2+7,2,3);
  // Tiny sword
  $r(ctx,ex+s,ey-s*2-1,2,s*2+4,"#aaa"); $r(ctx,ex+s-3,ey-s*2,8,2,"#888");
}

function _skeleton(ctx,ex,ey,s,t) {
  const walk=(Math.sin(t*8)*4)|0;
  _shadow(ctx,ex,ey,s);
  // Body (ribcage)
  ctx.fillStyle="#d8d4c4";
  ctx.beginPath(); ctx.roundRect(ex-s+2,ey-s+3,s*2-4,s*2-4,3); ctx.fill();
  // Rib lines
  ctx.fillStyle="rgba(0,0,0,0.18)";
  for(let i=0;i<3;i++) ctx.fillRect(ex-s+4,ey-s+6+i*5,s*2-8,2);
  // Arms
  $r(ctx,ex-s-2,ey-s+4+walk,4,8,"#d8d4c4"); $r(ctx,ex+s-2,ey-s+4-walk,4,8,"#d8d4c4");
  // Legs
  $r(ctx,ex-s+4,ey+2,4,7,"#d8d4c4"); $r(ctx,ex+s-8,ey+2+Math.abs(walk)-2,4,7,"#d8d4c4");
  // Skull (large, round)
  _circle(ctx,ex,ey-s*2+2,s*1.1,"#e8e4d4");
  // Eye sockets (dark filled circles — classic skull look)
  _circle(ctx,ex-s*0.38,ey-s*2,s*0.32,"#1a1a2a");
  _circle(ctx,ex+s*0.38,ey-s*2,s*0.32,"#1a1a2a");
  // Nose cavity
  ctx.fillStyle="#555"; ctx.fillRect(ex-1,ey-s*2+4,2,2);
  // Teeth
  ctx.fillStyle="#d8d4c4"; ctx.fillRect(ex-4,ey-s*2+6,8,3);
  ctx.fillStyle="#fff"; for(let i=0;i<3;i++) ctx.fillRect(ex-3+i*3,ey-s*2+7,2,2);
  // Bone weapon
  $r(ctx,ex+s,ey-s*2-3,3,s*3+4,"#d8d4c4");
  $r(ctx,ex+s-4,ey-s*2-3,11,3,"#d8d4c4"); $r(ctx,ex+s-4,ey-s+2,11,3,"#d8d4c4");
}

function _orc(ctx,ex,ey,s,t) {
  const eo=(Math.sin(t*2.5)*4)|0;
  _shadow(ctx,ex,ey,s+2);
  // Body (wider)
  ctx.fillStyle="#8a4400";
  ctx.beginPath(); ctx.roundRect(ex-s-1,ey-s+2,s*2+4,s*2+3,5); ctx.fill();
  // Arms (sway like drunk)
  $r(ctx,ex-s-4,ey-s+3+eo,5,9,"#7a3a00"); $r(ctx,ex+s-1,ey-s+3-eo,5,9,"#7a3a00");
  // Legs
  $r(ctx,ex-s+3,ey+3,6,8,"#6a3000"); $r(ctx,ex+s-9,ey+3+eo,6,8,"#6a3000");
  // Head (round)
  _circle(ctx,ex,ey-s*2+2,s*1.1,"#aa5500");
  // Eyes (bulging yellow)
  _eye(ctx,ex-s*0.4+eo,ey-s*2,s*0.32,"#ffcc00");
  _eye(ctx,ex+s*0.4-eo,ey-s*2,s*0.32,"#ffcc00");
  // Tusks
  ctx.fillStyle="#ffe0aa"; ctx.fillRect(ex-5,ey-s*2+7,3,5); ctx.fillRect(ex+2,ey-s*2+7,3,5);
  // Axe
  $r(ctx,ex+s+2,ey-s*2-4,4,s*3+6,"#5a3000"); $r(ctx,ex+s,ey-s*2-8,12,8,"#8B5500");
}

function _troll(ctx,ex,ey,s,t) {
  const fi=(Math.sin(t*6)*3)|0;
  _shadow(ctx,ex,ey,s+3);
  // Huge body
  ctx.fillStyle="#3a5500";
  ctx.beginPath(); ctx.roundRect(ex-s-2,ey-s+2,s*2+6,s*2+7,6); ctx.fill();
  // Fists
  _circle(ctx,ex-s-4,ey+fi,s*0.55,"#2a4400");
  _circle(ctx,ex+s+4,ey-fi,s*0.55,"#2a4400");
  // Big round head
  _circle(ctx,ex,ey-s*2+1,s*1.2,"#4a6a00");
  // Eyes (angry red)
  _eye(ctx,ex-s*0.4,ey-s*2-2,s*0.33,"#ff2200");
  _eye(ctx,ex+s*0.4,ey-s*2-2,s*0.33,"#ff2200");
  // Uni-brow ridge
  ctx.fillStyle="#2a4000"; ctx.fillRect(ex-s*0.65,ey-s*2-5,s*1.3,3);
  // Mouth (scowl)
  ctx.strokeStyle="#1a2a00"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(ex,ey-s*2+5,5,0.2,Math.PI-0.2); ctx.stroke();
  // Club
  $r(ctx,ex+s+2,ey-s*2,6,s*3,"#4a3000"); _circle(ctx,ex+s+5,ey-s*2,8,"#5a4000");
}

function _dragon(ctx,ex,ey,s,t) {
  const fl=(Math.sin(t*14)*6)|0;
  _shadow(ctx,ex,ey,s+2);
  // Wings
  ctx.fillStyle="#991100";
  ctx.beginPath(); ctx.moveTo(ex-s+2,ey-s+4); ctx.lineTo(ex-s*3+2,ey-s+fl); ctx.lineTo(ex-s+2,ey-2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(ex+s-2,ey-s+4); ctx.lineTo(ex+s*3-2,ey-s+fl); ctx.lineTo(ex+s-2,ey-2); ctx.closePath(); ctx.fill();
  // Body (scaly)
  ctx.fillStyle="#cc2200";
  ctx.beginPath(); ctx.roundRect(ex-s+2,ey-s+2,s*2-4,s*2-2,5); ctx.fill();
  // Head
  _circle(ctx,ex,ey-s*2+3,s*1.0,"#dd3300");
  // Eyes (glowing yellow)
  _eye(ctx,ex-s*0.4,ey-s*2+1,s*0.28,"#ffee00");
  _eye(ctx,ex+s*0.4,ey-s*2+1,s*0.28,"#ffee00");
  // Fire breath (animated)
  if((t*5|0)%6===0){
    ctx.globalAlpha=0.85;
    ctx.fillStyle="#ff8800";
    ctx.beginPath(); ctx.moveTo(ex+s-2,ey-s*2+4); ctx.lineTo(ex+s+12,ey-s*2+1); ctx.lineTo(ex+s+8,ey-s*2+8); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#ffff00";
    ctx.beginPath(); ctx.moveTo(ex+s,ey-s*2+4); ctx.lineTo(ex+s+8,ey-s*2+3); ctx.lineTo(ex+s+6,ey-s*2+7); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=1;
  }
  // Tail
  $r(ctx,ex-s-4,ey+2,7,3,"#991100"); $r(ctx,ex-s-8,ey+4,5,2,"#991100");
}

// ── New enemies ─────────────────────────────────────────────────────────────
function _ogre(ctx,ex,ey,s,t) {
  _shadow(ctx,ex,ey,s+3);
  // Massive body (mossy green)
  ctx.fillStyle="#2a5500";
  ctx.beginPath(); ctx.roundRect(ex-s-3,ey-s+1,s*2+8,s*2+9,7); ctx.fill();
  // Arms (thick)
  $r(ctx,ex-s-6,ey-s+3,7,10,"#224400"); $r(ctx,ex+s-1,ey-s+3,7,10,"#224400");
  // Legs
  $r(ctx,ex-s+3,ey+4,7,10,"#1a3800"); $r(ctx,ex+s-10,ey+4,7,10,"#1a3800");
  // Big round head
  _circle(ctx,ex,ey-s*2,s*1.25,"#336611");
  // Eyes (red)
  _eye(ctx,ex-s*0.45,ey-s*2-3,s*0.35,"#ff4400");
  _eye(ctx,ex+s*0.45,ey-s*2-3,s*0.35,"#ff4400");
  // Brow ridge
  ctx.fillStyle="#224400"; ctx.fillRect(ex-s*0.75,ey-s*2-7,s*1.5,4);
  // Nose (bulbous)
  _circle(ctx,ex,ey-s*2+4,s*0.28,"#285500");
  // Club
  $r(ctx,ex+s+3,ey-s*2-6,8,s*4+10,"#7a4400");
  _circle(ctx,ex+s+7,ey-s*2-6,10,"#8B5500");
  for(let i=0;i<3;i++) { ctx.fillStyle="#cc7700"; ctx.beginPath(); ctx.moveTo(ex+s-1+i*5,ey-s*2-16); ctx.lineTo(ex+s+2+i*5,ey-s*2-10); ctx.lineTo(ex+s+5+i*5,ey-s*2-16); ctx.closePath(); ctx.fill(); }
}

function _harpy(ctx,ex,ey,s,t) {
  const fw=(Math.sin(t*14)*9)|0;
  _shadow(ctx,ex,ey,s+1);
  // Wings
  ctx.fillStyle="#6622aa";
  ctx.beginPath(); ctx.moveTo(ex-s+2,ey-s+2); ctx.lineTo(ex-s*3,ey-s-8+fw); ctx.lineTo(ex-s+2,ey+4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(ex+s-2,ey-s+2); ctx.lineTo(ex+s*3,ey-s-8+fw); ctx.lineTo(ex+s-2,ey+4); ctx.closePath(); ctx.fill();
  // Wing highlight
  ctx.fillStyle="#9944cc"; ctx.globalAlpha=0.5;
  ctx.beginPath(); ctx.moveTo(ex-s+3,ey-s+3); ctx.lineTo(ex-s*2.5,ey-s-4+fw); ctx.lineTo(ex-s+3,ey); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(ex+s-3,ey-s+3); ctx.lineTo(ex+s*2.5,ey-s-4+fw); ctx.lineTo(ex+s-3,ey); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=1;
  // Body
  ctx.fillStyle="#7733aa";
  ctx.beginPath(); ctx.roundRect(ex-s+2,ey-s,s*2-4,s*2,4); ctx.fill();
  // Head
  _circle(ctx,ex,ey-s*2+3,s*0.95,"#9944aa");
  // Eyes
  _eye(ctx,ex-s*0.38,ey-s*2+1,s*0.28,"#ffff00");
  _eye(ctx,ex+s*0.38,ey-s*2+1,s*0.28,"#ffff00");
  // Beak
  ctx.fillStyle="#ff9900"; ctx.beginPath(); ctx.moveTo(ex-3,ey-s*2+6); ctx.lineTo(ex+3,ey-s*2+6); ctx.lineTo(ex,ey-s*2+11); ctx.closePath(); ctx.fill();
}

function _necromancer(ctx,ex,ey,s,t) {
  _shadow(ctx,ex,ey,s);
  // Robe (dark purple)
  ctx.fillStyle="#1a0033";
  ctx.beginPath(); ctx.moveTo(ex-s+1,ey+2); ctx.lineTo(ex-s+2,ey-s+3); ctx.lineTo(ex+s-2,ey-s+3); ctx.lineTo(ex+s-1,ey+2); ctx.closePath(); ctx.fill();
  // Robe hem glow
  ctx.strokeStyle="rgba(170,0,255,0.45)"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(ex-s+1,ey+2); ctx.lineTo(ex+s-1,ey+2); ctx.stroke();
  // Head / hood
  _circle(ctx,ex,ey-s*2+2,s*0.95,"#2a0044");
  // Glowing eyes
  ctx.shadowColor="#ff0055"; ctx.shadowBlur=8;
  _circle(ctx,ex-s*0.37,ey-s*2,s*0.27,"#ff0055");
  _circle(ctx,ex+s*0.37,ey-s*2,s*0.27,"#ff0055");
  ctx.shadowBlur=0;
  // Hood tip
  ctx.fillStyle="#1a0033";
  ctx.beginPath(); ctx.moveTo(ex-s*0.7,ey-s*2-5); ctx.lineTo(ex,ey-s*3+2); ctx.lineTo(ex+s*0.7,ey-s*2-5); ctx.closePath(); ctx.fill();
  // Staff
  $r(ctx,ex+s,ey-s*2-10,3,s*3+12,"#4a2066");
  const pr=5+Math.sin(t*4)*2;
  ctx.shadowColor="#bb00ff"; ctx.shadowBlur=10;
  _circle(ctx,ex+s+1,ey-s*2-10,pr,"#aa00ff");
  ctx.shadowBlur=0;
  ctx.globalAlpha=0.35+Math.sin(t*3)*0.25;
  _circle(ctx,ex+s+1,ey-s*2-10,pr+5,"#cc00ff");
  ctx.globalAlpha=1;
}

function _demon(ctx,ex,ey,s,t) {
  const fw=(Math.sin(t*12)*7)|0;
  _shadow(ctx,ex,ey,s+2);
  // Bat wings
  ctx.fillStyle="#770011";
  ctx.beginPath(); ctx.moveTo(ex-s+2,ey-s+2); ctx.lineTo(ex-s*4,ey-s*2+fw); ctx.lineTo(ex-s,ey+2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(ex+s-2,ey-s+2); ctx.lineTo(ex+s*4,ey-s*2+fw); ctx.lineTo(ex+s,ey+2); ctx.closePath(); ctx.fill();
  // Wing membrane highlight
  ctx.fillStyle="rgba(200,0,50,0.35)";
  ctx.beginPath(); ctx.moveTo(ex-s+2,ey-s+3); ctx.lineTo(ex-s*3.5,ey-s*2+fw); ctx.lineTo(ex-s,ey+1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(ex+s-2,ey-s+3); ctx.lineTo(ex+s*3.5,ey-s*2+fw); ctx.lineTo(ex+s,ey+1); ctx.closePath(); ctx.fill();
  // Body
  ctx.fillStyle="#aa0033";
  ctx.beginPath(); ctx.roundRect(ex-s+2,ey-s+1,s*2-4,s*2-1,5); ctx.fill();
  // Head
  _circle(ctx,ex,ey-s*2+2,s*1.0,"#cc0033");
  // Horns
  ctx.fillStyle="#440000";
  ctx.beginPath(); ctx.moveTo(ex-s*0.5,ey-s*2-3); ctx.lineTo(ex-s*0.3,ey-s*3+2); ctx.lineTo(ex-s*0.1,ey-s*2-3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(ex+s*0.1,ey-s*2-3); ctx.lineTo(ex+s*0.3,ey-s*3+2); ctx.lineTo(ex+s*0.5,ey-s*2-3); ctx.closePath(); ctx.fill();
  // Eyes (glowing)
  ctx.shadowColor="#ff2200"; ctx.shadowBlur=6;
  _eye(ctx,ex-s*0.38,ey-s*2+1,s*0.29,"#ff4400");
  _eye(ctx,ex+s*0.38,ey-s*2+1,s*0.29,"#ff4400");
  ctx.shadowBlur=0;
  // Claws
  $r(ctx,ex-s-2,ey+2,5,4,"#880022"); $r(ctx,ex+s-3,ey+2,5,4,"#880022");
  // Tail
  ctx.strokeStyle="#770011"; ctx.lineWidth=3; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(ex-s,ey+4); ctx.quadraticCurveTo(ex-s-8,ey+12,ex-s-6,ey+18); ctx.stroke();
}

function _boss(ctx,ex,ey,s,t) {
  const pulse = Math.sin(t * 3) * 0.12;
  _shadow(ctx, ex, ey, s + 5);

  // Pulsing dark aura
  ctx.globalAlpha = 0.28 + Math.abs(pulse);
  ctx.fillStyle = "#ff0000";
  ctx.beginPath(); ctx.arc(ex, ey - s, s * 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Body (massive, armoured)
  ctx.fillStyle = "#330000";
  ctx.beginPath(); ctx.roundRect(ex - s - 3, ey - s + 1, s * 2 + 8, s * 2 + 9, 7); ctx.fill();
  // Shoulder spikes
  for(let i = 0; i < 3; i++) {
    ctx.fillStyle = "#660000";
    ctx.beginPath(); ctx.moveTo(ex-s-3,ey-s+i*8); ctx.lineTo(ex-s-10,ey-s-3+i*8); ctx.lineTo(ex-s-3,ey-s+6+i*8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ex+s+3,ey-s+i*8); ctx.lineTo(ex+s+10,ey-s-3+i*8); ctx.lineTo(ex+s+3,ey-s+6+i*8); ctx.closePath(); ctx.fill();
  }
  // Arms
  $r(ctx,ex-s-5,ey-s+4,6,12,"#440000"); $r(ctx,ex+s-1,ey-s+4,6,12,"#440000");

  // Big round head
  _circle(ctx, ex, ey - s * 2 + 1, s * 1.3, "#550000");

  // Crown
  ctx.fillStyle = "#cc4400";
  for(let i = 0; i < 5; i++) {
    const cx2 = ex - s + i * s * 0.55;
    ctx.beginPath(); ctx.moveTo(cx2, ey-s*2-s*0.9); ctx.lineTo(cx2+s*0.25, ey-s*2-s*1.5); ctx.lineTo(cx2+s*0.5, ey-s*2-s*0.9); ctx.closePath(); ctx.fill();
  }
  $r(ctx, ex-s, ey-s*2-s*0.9, s*2, 4, "#882200");

  // Glowing eyes
  ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 12;
  _circle(ctx, ex - s * 0.38, ey - s * 2 + 1, s * 0.32, "#ff0000");
  _circle(ctx, ex + s * 0.38, ey - s * 2 + 1, s * 0.32, "#ff0000");
  ctx.shadowBlur = 0;
  _circle(ctx, ex - s * 0.38, ey - s * 2 + 1, s * 0.15, "#ffff00");
  _circle(ctx, ex + s * 0.38, ey - s * 2 + 1, s * 0.15, "#ffff00");

  // Mouth (sinister grin)
  ctx.strokeStyle = "#ff4400"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ex, ey - s * 2 + 6, s * 0.45, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.fillStyle = "#ffee00";
  for(let i = 0; i < 4; i++) ctx.fillRect(ex - s*0.5 + i * s*0.32, ey - s*2 + 6, s*0.18, s*0.28);
}

// ─── Projectile drawing ───────────────────────────────────────────────────
function drawProjectile(ctx, p) {
  if (p.dead) return;
  const colors = {
    cannon:      ["#aa8833","#333"],
    archer:      ["#aaff44","#88cc00"],
    prototype:   ["#00ffcc","#ffffff"],
    peacemaker:  ["#ff8800","#ffcc00"],
    bonecrusher: ["#ffcc44","#ffffff"],
    poison:      ["#44cc22","#88ff44"],
    missiles:    ["#ff4444","#ffcc00"],
    dagger:      ["#cc44cc","#ff88ff"],
    spawner:     ["#aaaaff","#ffffff"],
  };
  const [tc, bc] = colors[p.tType] || ["#ffffff","#aaaaaa"];

  for (let i = 0; i < p.trail.length; i++) {
    ctx.globalAlpha = ((i + 1) / p.trail.length) * 0.45;
    $r(ctx, p.trail[i].x-1, p.trail[i].y-1, 3, 3, tc);
  }
  ctx.globalAlpha = 1;

  // Bigger / more distinct projectile per type
  if (p.tType === "prototype") {
    $r(ctx,(p.x-1)|0,(p.y-3)|0,2,6,bc); $r(ctx,(p.x-3)|0,(p.y-1)|0,6,2,tc);
  } else if (p.tType === "missiles") {
    $r(ctx,(p.x-3)|0,(p.y-2)|0,6,4,"#cc2200"); $r(ctx,(p.x+3)|0,(p.y-1)|0,3,2,"#ffcc00");
  } else if (p.tType === "poison") {
    ctx.fillStyle=tc; ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.5; ctx.fillStyle="#88ff44"; ctx.beginPath(); ctx.arc(p.x,p.y,6,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  } else if (p.tType === "cannon") {
    $r(ctx,(p.x-3)|0,(p.y-3)|0,6,6,"#333"); $r(ctx,(p.x-2)|0,(p.y-4)|0,3,3,"#666");
  } else {
    $r(ctx,(p.x-2)|0,(p.y-1)|0,6,2,bc); $r(ctx,(p.x+2)|0,(p.y-2)|0,2,4,tc);
  }
}

// ─── Soldier ─────────────────────────────────────────────────────────────
function drawSoldier(ctx, s) {
  if (s.dead) return;
  const x=s.x|0, y=s.y|0, b=(Math.sin(s.animT*10)*1.5)|0;
  $r(ctx,x-4,y-8+b,8,7,"#2244cc");
  $r(ctx,x-3,y-14+b,6,7,"#ffddaa");
  $r(ctx,x-4,y-15+b,8,4,"#888"); $r(ctx,x-4,y-15+b,8,2,"#aaa");
  $r(ctx,x+4,y-13+b,2,10,"#ccc");
  $r(ctx,x-6,y-10+b,3,8,"#8844ff");
  $r(ctx,x-5,y-18,10,2,"#333");
  $r(ctx,x-5,y-18,(10*s.hp/s.maxHp)|0,2,"#44ff44");
}

// ─── Particles / FloatingText ─────────────────────────────────────────────
function drawParticle(ctx, p) {
  if (p.dead) return;
  ctx.globalAlpha = p.life / p.maxLife;
  $r(ctx,(p.x-p.size/2)|0,(p.y-p.size/2)|0,p.size,p.size,p.color);
  ctx.globalAlpha = 1;
}
function drawFloat(ctx, f) {
  if (f.dead) return;
  ctx.globalAlpha = Math.min(1, f.life / 0.5);
  ctx.fillStyle = f.color; ctx.font = "bold 10px monospace";
  ctx.textAlign = "center"; ctx.fillText(f.txt, f.x|0, f.y|0);
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}

// ─── Range ring ───────────────────────────────────────────────────────────
function drawRange(ctx, tower, tMod) {
  const r = tower.range * ((tMod && tMod.range) || 1);
  const col = TOWER_TYPES[tower.type].color || "#88aaff";
  ctx.globalAlpha = 0.12; ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(tower.cx, tower.cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.55; ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.arc(tower.cx, tower.cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
}

// ─── Title screen ─────────────────────────────────────────────────────────
function drawTitle(ctx) {
  ctx.fillStyle = "rgba(0,0,0,0.70)"; ctx.fillRect(0, 0, CVW, CVH);
  $r(ctx, 60, 100, 520, 20, "#cc2200"); $r(ctx, 60, 120, 520, 2, "#ff4400");
  ctx.fillStyle = "#ffdd00"; ctx.font = "bold 20px 'Press Start 2P',monospace";
  ctx.textAlign = "center"; ctx.fillText("VILLAGE TOWER DEFENSE", CVW/2, 130);
  $r(ctx, 70, 145, 500, 290, "rgba(8,8,24,0.94)");
  ctx.strokeStyle = "#334466"; ctx.lineWidth = 2; ctx.strokeRect(70, 145, 500, 290);

  ctx.fillStyle = "#88aaff"; ctx.font = "8px 'Press Start 2P',monospace";
  ctx.fillText("13 towers · 10 enemies · 5 rotating maps", CVW/2, 168);
  ctx.fillStyle = "#ffddaa"; ctx.font = "7px monospace";
  const lines = [
    "🗺 Map rotates every 10 waves! New layout + bonus gold & lives",
    "🔀 Relocate towers FREE before each wave",
    "─────────────────────────────────────────",
    "Classic:  🏰 Cannon  🏹 Archer  ⚔ Barracks",
    "Weapons:  ⚡ Prototype  🔫 Peacemaker(W10)  💥 Bone Crusher",
    "          ☠ Poison  🚀 Missiles  🗡 Twins Dagger",
    "Auras:    🌟 Golden  🕳 Black Hole  ⏱ Chrono  🪓 Logging Axe",
    "─────────────────────────────────────────",
    "Maps:  Village Road · Twin Forks · Zigzag Alley",
    "       Spiral Keep · Double Cross  (2 roads!)",
    "Upgrade towers to Level 999!  Enemies get harder each tier.",
  ];
  lines.forEach((l, i) => ctx.fillText(l, CVW/2, 192 + i*20));
  ctx.fillStyle = "#88ff88"; ctx.font = "9px 'Press Start 2P',monospace";
  ctx.fillText("▶ Click to begin", CVW/2, 418);
  ctx.textAlign = "left";
}

// ─── Map-change banner (rendered over gameplay canvas) ────────────────────
function drawMapChangeBanner(ctx, mapName, mapId, bonus) {
  ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(60, 140, 520, 200);
  ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 3; ctx.strokeRect(60, 140, 520, 200);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcc00"; ctx.font = "bold 14px 'Press Start 2P',monospace";
  ctx.fillText("🗺 MAP CHANGED!", CVW/2, 178);
  ctx.fillStyle = "#88aaff"; ctx.font = "10px 'Press Start 2P',monospace";
  ctx.fillText(mapName, CVW/2, 208);
  ctx.fillStyle = "#ffddaa"; ctx.font = "8px monospace";
  ctx.fillText(`Map ${mapId + 1} of 5  •  All towers refunded at 100%`, CVW/2, 236);
  ctx.fillStyle = "#88ff88"; ctx.font = "9px monospace";
  ctx.fillText(`+${bonus.gold}g bonus  +${bonus.lives} lives  Relocate towers freely!`, CVW/2, 262);
  ctx.fillStyle = "#88aaff"; ctx.font = "7px 'Press Start 2P',monospace";
  ctx.fillText("Place your towers, then press START WAVE", CVW/2, 296);
  ctx.textAlign = "left";
}
