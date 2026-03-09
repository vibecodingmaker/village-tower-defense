"use strict";
// ─── Tiny helpers ────────────────────────────────────────────────────────
const $r = (ctx,x,y,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(x|0,y|0,w|0,h|0); };
const $p = (ctx,x,y,c)=>{ ctx.fillStyle=c; ctx.fillRect(x|0,y|0,1,1); };
const $shade = (hex,a)=>{
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,Math.max(0,r+a))},${Math.min(255,Math.max(0,g+a))},${Math.min(255,Math.max(0,b+a))})`;
};

// ─── Background / map ────────────────────────────────────────────────────
function drawBackground(ctx) {
  const now = performance.now() * 0.001;

  // Grass base
  $r(ctx, 0, 0, CVW, CVH, "#4a7c3f");
  // Darker grass variation patches
  ctx.fillStyle = "#3e6e36";
  [[46,82],[492,142],[82,312],[542,384],[200,448]].forEach(([x,y])=>ctx.fillRect(x,y,32,22));

  // Perimeter stone walls (left / right)
  for (const wx of [0, CVW-8]) {
    $r(ctx, wx, 0, 8, CVH, "#777");
    for (let y = 0; y < CVH; y += 20) $r(ctx, wx, y, 8, 12, "#aaa");
  }
  // Top wall (gap at x=302‥338 for road)
  $r(ctx, 0, 0, 302, 8, "#777"); $r(ctx, 338, 0, CVW-338, 8, "#777");
  for (let x = 0; x < 302; x += 20) $r(ctx, x, 0, 12, 8, "#aaa");
  for (let x = 338; x < CVW; x += 20) $r(ctx, x, 0, 12, 8, "#aaa");
  // Bottom wall
  $r(ctx, 0, CVH-8, 302, 8, "#777"); $r(ctx, 338, CVH-8, CVW-338, 8, "#777");
  for (let x = 0; x < 302; x += 20) $r(ctx, x, CVH-8, 12, 8, "#aaa");
  for (let x = 338; x < CVW; x += 20) $r(ctx, x, CVH-8, 12, 8, "#aaa");

  // Blue lake (top-left)
  $r(ctx, 10, 10, 122, 98, "#1a5a9a");
  $r(ctx, 12, 12, 118, 94, "#2a7acd");
  for (let i = 0; i < 4; i++) {
    const sx = 22 + i*22 + Math.sin(now*0.9+i*1.2)*4;
    $r(ctx, sx|0, 38+i*12, 14, 2, "#5599ee");
  }
  $r(ctx, 18, 18, 8, 2, "#88bbff"); $r(ctx, 90, 74, 14, 2, "#88bbff");
  ctx.fillStyle="#1a4a7a"; ctx.font="7px monospace"; ctx.fillText("~ LAKE ~", 30, 62);

  drawRoad(ctx);

  // INN building — top right
  _building(ctx, 522, 18, 90, 74, "INN", "#7a4a18", "#cc3333");
  // PUB building — right mid
  _building(ctx, 508, 328, 102, 82, "PUB", "#6a3a10", "#aa2222");
  // Stone watchtower — left of lake
  _watchtower(ctx, 10, 10, 28, 86);
  // Well
  _well(ctx, 374, 374);

  // Scattered trees (avoiding road)
  const trees = [
    [172,56],[210,72],[208,42],[88,140],[84,178],[82,220],[236,192],[254,208],[232,220],
    [540,50],[580,90],[562,142],[568,198],[546,218],
    [84,354],[83,410],[540,314],[555,364],[560,417],
    [200,447],[420,452],[440,464],[174,464],[490,464],
  ];
  trees.forEach(([x,y]) => _tree(ctx, x, y));
}

function drawRoad(ctx) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // Shadow border
  ctx.strokeStyle = "#4a2800"; ctx.lineWidth = ROAD_W + 6;
  ctx.beginPath(); ctx.moveTo(PATH[0].x, PATH[0].y);
  PATH.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
  // Dirt fill
  ctx.strokeStyle = "#8B6014"; ctx.lineWidth = ROAD_W;
  ctx.beginPath(); ctx.moveTo(PATH[0].x, PATH[0].y);
  PATH.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
  // Lighter centre strip
  ctx.strokeStyle = "#c09030"; ctx.lineWidth = ROAD_W - 14;
  ctx.beginPath(); ctx.moveTo(PATH[0].x, PATH[0].y);
  PATH.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
  // Small pebbles
  ctx.fillStyle = "#7a5010";
  [[316,452],[324,402],[144,382],[148,302],[318,267],[322,164],[468,167],[474,142],[316,82]]
    .forEach(([x,y])=>ctx.fillRect(x,y,4,3));
}

function _building(ctx, x, y, w, h, label, wall, roof) {
  const wy = y + (h*0.34)|0;
  $r(ctx, x, wy, w, h*0.66, wall);
  // Plank lines
  ctx.fillStyle = $shade(wall,-18);
  for (let oy = wy+8; oy < y+h; oy += 12) ctx.fillRect(x, oy, w, 2);
  // Roof triangle
  ctx.fillStyle = roof;
  ctx.beginPath(); ctx.moveTo(x-5,wy+2); ctx.lineTo(x+w/2,y+2); ctx.lineTo(x+w+5,wy+2); ctx.closePath(); ctx.fill();
  // Roof shadow
  $r(ctx, x, wy-2, w, 6, $shade(roof,-28));
  // Chimney
  $r(ctx, x+w-22, y+4, 8, wy-y-2, "#666"); $r(ctx, x+w-24, y+2, 12, 4, "#444");
  // Windows
  $r(ctx, x+8,     y+h*0.42, 12, 10, "#ffeeaa");
  $r(ctx, x+w-22,  y+h*0.42, 12, 10, "#ffeeaa");
  // Window bars
  ctx.fillStyle = "#885500";
  ctx.fillRect(x+14,    y+h*0.42, 1, 10); ctx.fillRect(x+8,    y+h*0.47, 12, 1);
  ctx.fillRect(x+w-16,  y+h*0.42, 1, 10); ctx.fillRect(x+w-22, y+h*0.47, 12, 1);
  // Door
  $r(ctx, x+w/2-8, y+h*0.66, 16, h*0.34+2, "#4a2800");
  $r(ctx, x+w/2-6, y+h*0.68, 12, h*0.32,   "#6a3800");
  // Sign
  $r(ctx, x+w/2-18, y+h*0.46, 36, 12, "#cc9900");
  ctx.fillStyle="#220000"; ctx.font="7px monospace"; ctx.textAlign="center";
  ctx.fillText(label, x+w/2, y+h*0.46+9); ctx.textAlign="left";
}

function _watchtower(ctx, x, y, w, h) {
  $r(ctx, x, y+h*0.3, w, h*0.7, "#777");
  $r(ctx, x+2, y+h*0.3+2, w-4, h*0.68, "#999");
  $r(ctx, x+w/2-2, y+h*0.5, 4, 8, "#333");
  $r(ctx, x-3, y+h*0.28, w+6, h*0.06, "#888");
  for (let i=0;i<3;i++) $r(ctx, x+i*(w/2)-2, y+h*0.22, w/3, h*0.08, "#bbb");
  $r(ctx, x+w/2-2, y+h*0.38, 4, 10, "#555");
}

function _well(ctx, x, y) {
  $r(ctx,x-14,y-4,28,16,"#888"); $r(ctx,x-12,y-2,24,12,"#aaa");
  $r(ctx,x-10,y,20,8,"#2a7acd");
  $r(ctx,x-12,y-16,3,14,"#5a3d1a"); $r(ctx,x+9,y-16,3,14,"#5a3d1a");
  $r(ctx,x-14,y-18,28,4,"#7a5a2a"); $r(ctx,x-1,y-16,2,10,"#aa8844");
}

function _tree(ctx, x, y) {
  $r(ctx,x-3,y-6,6,10,"#5a3d1a");
  $r(ctx,x-13,y-22,26,18,"#2d8b2d");
  $r(ctx,x-10,y-32,20,14,"#3aaa3a");
  $r(ctx,x-7, y-40,14,12,"#22772a");
  $r(ctx,x-8, y-30, 6, 4,"#55cc55");
  $r(ctx,x-4, y-36, 4, 4,"#55cc55");
}

// ─── Build spots ─────────────────────────────────────────────────────────
function drawBuildSpots(ctx, spots, selId, placing) {
  for (const s of spots) {
    if (s.tower) continue;
    const hov = s.id === selId;
    ctx.globalAlpha = hov ? 0.78 : 0.50;
    $r(ctx, s.cx-SPOT_R, s.cy-SPOT_R, SPOT_R*2, SPOT_R*2, hov?"#00ff88":"#88ff88");
    ctx.globalAlpha = 1;
    ctx.strokeStyle = hov ? "#00cc44" : "#44aa44"; ctx.lineWidth = 2;
    ctx.strokeRect(s.cx-SPOT_R, s.cy-SPOT_R, SPOT_R*2, SPOT_R*2);
    $r(ctx, s.cx-1, s.cy-7, 2, 14, hov?"#00cc44":"#44aa44");
    $r(ctx, s.cx-7, s.cy-1, 14, 2,  hov?"#00cc44":"#44aa44");
  }
}

// ─── Tower drawing ────────────────────────────────────────────────────────
function drawTower(ctx, t) {
  const {cx,cy,level,flash} = t;
  $r(ctx,cx-15,cy+2,30,10,"#777"); $r(ctx,cx-13,cy,26,8,"#999"); // base
  if (t.type==="cannon")  _cannon(ctx,cx,cy,level,flash);
  else if (t.type==="archer")  _archer(ctx,cx,cy,level,flash);
  else                         _barracks(ctx,cx,cy,level,flash);
  // level pips
  const dotC=["#ffdd00","#ffaa00","#ff7700","#ff2200","#cc00ff"];
  for(let i=0;i<level;i++) $r(ctx,cx-10+i*5,cy+2,4,4,dotC[i]);
}

function _cannon(ctx,cx,cy,lv,fl) {
  $r(ctx,cx-12,cy-24,24,26,"#778899"); $r(ctx,cx-10,cy-22,20,22,"#889aaa");
  for(let i=-1;i<=1;i++) $r(ctx,cx+i*8-3,cy-30,6,8,"#6a7a8a"); // battlements
  $r(ctx,cx,cy-18,18,7,"#444"); $r(ctx,cx+14,cy-19,8,9,"#333"); // barrel
  if(fl>0){ $r(ctx,cx+20,cy-20,10,11,"#ffaa00"); $r(ctx,cx+23,cy-18,5,7,"#ffff00"); }
  $r(ctx,cx+2,cy-15,5,5,"#222"); // ball slot
}

function _archer(ctx,cx,cy,lv,fl) {
  $r(ctx,cx-10,cy-28,20,30,"#7a5020"); $r(ctx,cx-8,cy-26,16,26,"#9a6830");
  $r(ctx,cx-2,cy-22,4,12,"#332200"); // slit
  $r(ctx,cx-3,cy-34,6,7,"#ddbb88"); $r(ctx,cx-4,cy-28,8,6,"#448844"); // figure
  $r(ctx,cx+4,cy-32,2,8,"#8B4513"); // bow post
  if(fl>0) $r(ctx,cx+6,cy-30,10,2,"#ffcc00");
  for(let i=0;i<3;i++) $r(ctx,cx-8+i*7,cy-32,5,6,"#6a4018"); // crenellations
}

function _barracks(ctx,cx,cy,lv,fl) {
  $r(ctx,cx-15,cy-22,30,24,"#334499"); $r(ctx,cx-13,cy-20,26,20,"#4455aa");
  $r(ctx,cx-5,cy-12,10,14,"#223388"); $r(ctx,cx-4,cy-10,8,12,"#334499"); // door
  $r(ctx,cx-1,cy-32,2,12,"#555"); // pole
  const fw = (Math.sin(performance.now()*0.004)*2)|0;
  $r(ctx,cx+1,cy-32,10+fw,7,"#cc2200"); // flag
  if(fl>0){ $r(ctx,cx-14,cy-20,4,4,"#ff8800"); $r(ctx,cx+10,cy-20,4,4,"#ff8800"); }
}

// ─── Enemy drawing ────────────────────────────────────────────────────────
function drawEnemy(ctx, e) {
  if (e.dead || e.escaped) return;
  const flyY = e.flies ? -10 : 0;
  const bob  = (Math.sin(e.animT*8)*1.5)|0;
  const ex   = (e.x + e.wobOff)|0;
  const ey   = (e.y + flyY + bob)|0;
  const s    = e.size;

  if (e.flies) { // shadow on ground
    ctx.globalAlpha=0.22; $r(ctx,ex-s,e.y-3,s*2,5,"#000"); ctx.globalAlpha=1;
  }

  if      (e.type==="goblin") _goblin(ctx,ex,ey,s,e.animT);
  else if (e.type==="orc")    _orc(ctx,ex,ey,s,e.animT);
  else if (e.type==="troll")  _troll(ctx,ex,ey,s,e.animT);
  else if (e.type==="dragon") _dragon(ctx,ex,ey,s,e.animT);

  // HP bar
  const bW = s*2+4, bY = ey-s*2-10;
  $r(ctx,ex-bW/2,bY,bW,4,"#333");
  const pct=e.hp/e.maxHp;
  $r(ctx,ex-bW/2,bY,(bW*pct)|0,4, pct>0.5?"#44ff44":pct>0.25?"#ffaa00":"#ff2222");

  // Speech bubble
  if (e.speechT > 0) {
    const tw = e.speech.length*5+8, bx=(ex-tw/2)|0, by=bY-14;
    $r(ctx,bx,by,tw,11,"rgba(255,255,220,0.93)");
    ctx.fillStyle="#333"; ctx.font="7px monospace"; ctx.fillText(e.speech,bx+4,by+8);
  }
}

function _goblin(ctx,ex,ey,s,t) {
  $r(ctx,ex-s+2,ey-s+2,s*2-4,s*2-2,"#1a8a1a");
  $r(ctx,ex-s+1,ey-s*2+2,s*2-2,s+4,"#33bb33");
  $r(ctx,ex-s-2,ey-s*2+3,4,6,"#22aa22"); $r(ctx,ex+s-2,ey-s*2+3,4,6,"#22aa22"); // ears
  $r(ctx,ex-4,ey-s*2+4,3,3,"#ff3300"); $r(ctx,ex+1,ey-s*2+4,3,3,"#ff3300"); // eyes
  $r(ctx,ex-1,ey-s*2+7,2,2,"#118811"); // nose
  $r(ctx,ex+s-2,ey-s*2+2,2,s*2+2,"#888"); $r(ctx,ex+s-4,ey-s*2+2,4,3,"#888"); // knife
}

function _orc(ctx,ex,ey,s,t) {
  $r(ctx,ex-s,ey-s+2,s*2,s*2+2,"#7a4200");
  $r(ctx,ex-s+1,ey-s*2+1,s*2-2,s*2,"#aa5800");
  const eo=(Math.sin(t*2.5)*3)|0;
  $r(ctx,ex-5+eo,ey-s*2+4,4,4,"#ffee00"); $r(ctx,ex+2-eo,ey-s*2+4,4,4,"#ffee00");
  $r(ctx,ex-4+eo,ey-s*2+5,2,2,"#330000"); $r(ctx,ex+3-eo,ey-s*2+5,2,2,"#330000");
  $r(ctx,ex-3,ey-s*2+s+1,2,4,"#eeddaa"); $r(ctx,ex+1,ey-s*2+s+1,2,4,"#eeddaa"); // tusks
  $r(ctx,ex+s-2,ey-s*2,5,s*3+4,"#5a3000"); $r(ctx,ex+s-4,ey-s*2-2,9,7,"#7a5000"); // club
}

function _troll(ctx,ex,ey,s,t) {
  $r(ctx,ex-s,ey-s+2,s*2+2,s*2+6,"#445500");
  $r(ctx,ex-s,ey-s*2,s*2+2,s*2+2,"#667700");
  $r(ctx,ex-5,ey-s*2+4,4,3,"#ff2200"); $r(ctx,ex+1,ey-s*2+4,4,3,"#ff2200"); // eyes
  $r(ctx,ex-6,ey-s*2+2,6,2,"#334400"); $r(ctx,ex+1,ey-s*2+2,6,2,"#334400"); // brows
  $r(ctx,ex-3,ey-s*2+8,6,5,"#556600"); // nose
  const fi=(Math.sin(t*6)*2)|0;
  $r(ctx,ex-s-4,ey+fi,7,7,"#556600"); $r(ctx,ex+s-3,ey-fi,7,7,"#556600"); // fists
  if((t*2|0)%4===0) $r(ctx,ex+s,ey-s*2+2,2,3,"#aaddff"); // sweat drop
}

function _dragon(ctx,ex,ey,s,t) {
  const fl=(Math.sin(t*14)*5)|0;
  ctx.fillStyle="#881100";
  ctx.beginPath(); ctx.moveTo(ex-s+2,ey-s+4); ctx.lineTo(ex-s*3+2,ey-s+fl); ctx.lineTo(ex-s+2,ey-2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(ex+s-2,ey-s+4); ctx.lineTo(ex+s*3-2,ey-s+fl); ctx.lineTo(ex+s-2,ey-2); ctx.closePath(); ctx.fill();
  $r(ctx,ex-s+2,ey-s+2,s*2-4,s*2-2,"#cc2200"); // body
  $r(ctx,ex-s+3,ey-s*2+4,s*2-6,s+4,"#ff3300"); // head
  $r(ctx,ex-2,ey-s*2+6,4,4,"#ffff00"); $r(ctx,ex-1,ey-s*2+7,2,2,"#222"); // eye
  if((t*5|0)%7===0){ $r(ctx,ex+s-4,ey-s*2+8,8,3,"#ff8800"); $r(ctx,ex+s,ey-s*2+9,5,2,"#ffcc00"); } // fire
  $r(ctx,ex-s-4,ey+2,6,3,"#991100"); $r(ctx,ex-s-7,ey+4,4,2,"#991100"); // tail
}

// ─── Projectile ───────────────────────────────────────────────────────────
function drawProjectile(ctx, p) {
  if (p.dead) return;
  const tc = p.tType==="cannon" ? "#aa8833" : "#aaff44";
  for (let i=0; i<p.trail.length; i++) {
    ctx.globalAlpha = ((i+1)/p.trail.length)*0.4;
    $r(ctx,p.trail[i].x-1,p.trail[i].y-1,3,3,tc);
  }
  ctx.globalAlpha=1;
  if (p.tType==="cannon") {
    $r(ctx,(p.x-3)|0,(p.y-3)|0,6,6,"#333"); $r(ctx,(p.x-2)|0,(p.y-4)|0,3,3,"#666");
  } else {
    $r(ctx,(p.x-2)|0,(p.y-1)|0,6,2,"#88cc00"); $r(ctx,(p.x+2)|0,(p.y-2)|0,2,4,"#ccff44");
  }
}

// ─── Soldier ─────────────────────────────────────────────────────────────
function drawSoldier(ctx, s) {
  if (s.dead) return;
  const x=s.x|0, y=s.y|0, b=(Math.sin(s.animT*10)*1.5)|0;
  $r(ctx,x-4,y-8+b,8,7,"#2244cc"); // body
  $r(ctx,x-3,y-14+b,6,7,"#ffddaa"); // head
  $r(ctx,x-4,y-15+b,8,4,"#888"); $r(ctx,x-4,y-15+b,8,2,"#aaa"); // helmet
  $r(ctx,x+4,y-13+b,2,10,"#ccc"); // sword
  $r(ctx,x-6,y-10+b,3,8,"#8844ff"); // shield
  $r(ctx,x-5,y-18,10,2,"#333");
  $r(ctx,x-5,y-18,(10*s.hp/s.maxHp)|0,2,"#44ff44"); // hp bar
}

// ─── Particle / FloatingText ──────────────────────────────────────────────
function drawParticle(ctx, p) {
  if (p.dead) return;
  ctx.globalAlpha = p.life/p.maxLife;
  $r(ctx,(p.x-p.size/2)|0,(p.y-p.size/2)|0,p.size,p.size,p.color);
  ctx.globalAlpha = 1;
}

function drawFloat(ctx, f) {
  if (f.dead) return;
  ctx.globalAlpha = Math.min(1, f.life/0.5);
  ctx.fillStyle = f.color; ctx.font = "bold 10px monospace";
  ctx.textAlign = "center"; ctx.fillText(f.txt, f.x|0, f.y|0);
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}

// ─── Range ring ───────────────────────────────────────────────────────────
function drawRange(ctx, tower, tMod) {
  const r = tower.range * ((tMod&&tMod.range)||1);
  ctx.globalAlpha=0.12; ctx.fillStyle="#88aaff";
  ctx.beginPath(); ctx.arc(tower.cx,tower.cy,r,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=0.55; ctx.strokeStyle="#88aaff"; ctx.lineWidth=1;
  ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.arc(tower.cx,tower.cy,r,0,Math.PI*2); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha=1;
}

// ─── Title / HUD overlay ─────────────────────────────────────────────────
function drawTitle(ctx) {
  ctx.fillStyle="rgba(0,0,0,0.68)"; ctx.fillRect(0,0,CVW,CVH);
  // Banner
  $r(ctx,80,120,480,18,"#cc2200"); $r(ctx,80,138,480,2,"#ff4400");
  ctx.fillStyle="#ffdd00"; ctx.font="bold 22px 'Press Start 2P',monospace";
  ctx.textAlign="center"; ctx.fillText("VILLAGE TOWER DEFENSE",CVW/2,148);
  // Sub-info panel
  $r(ctx,120,170,400,180,"rgba(10,10,30,0.92)");
  ctx.strokeStyle="#334466"; ctx.lineWidth=2; ctx.strokeRect(120,170,400,180);
  ctx.fillStyle="#88aaff"; ctx.font="9px 'Press Start 2P',monospace";
  ctx.fillText("Defend the village from waves of enemies!",CVW/2,196);
  ctx.fillStyle="#ffddaa"; ctx.font="8px monospace";
  ctx.fillText("🏰 Cannon  — heavy splash damage",CVW/2,220);
  ctx.fillText("🏹 Archer  — fast long-range shots",CVW/2,238);
  ctx.fillText("⚔ Barracks — spawns brave soldiers",CVW/2,256);
  ctx.fillText("Upgrade towers to reach level 5!",CVW/2,282);
  ctx.fillStyle="#88ff88"; ctx.font="10px 'Press Start 2P',monospace";
  ctx.fillText("▶ Click anywhere to begin",CVW/2,316);
  ctx.textAlign="left";
}
