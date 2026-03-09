"use strict";
// ─── Enemy ────────────────────────────────────────────────────────────────
class Enemy {
  constructor(type, waveNum, mods) {
    const d      = ENEMY_TYPES[type];
    this.type    = type;
    this.name    = d.name;
    this.maxHp   = Math.floor(d.hp * (1 + (waveNum-1)*0.10) * (mods.hp||1));
    this.hp      = this.maxHp;
    this.speed   = d.speed * (mods.speed||1);
    this.reward  = Math.floor(d.reward * (mods.reward||1));
    this.size    = d.size;
    this.color   = d.color;
    this.flies   = d.flies || false;
    this.wobAmt  = d.wobble || 0;

    // path tracking
    this.seg     = 0;
    this.x       = PATH[0].x;
    this.y       = PATH[0].y;
    this.dist    = 0;

    // visuals
    this.wobOff  = 0;
    this.animT   = Math.random() * Math.PI * 2;

    // state
    this.dead    = false;
    this.escaped = false;
    this.speech  = "";
    this.speechT = 0;
  }

  update(dt) {
    if (this.dead || this.escaped) return;
    this.animT += dt;
    if (this.wobAmt) this.wobOff = Math.sin(this.animT * 2.8) * this.wobAmt;
    this._move(this.speed * dt);
    if (this.speechT > 0) this.speechT -= dt;
  }

  _move(rem) {
    while (rem > 0.01) {
      if (this.seg >= PATH.length - 1) { this.escaped = true; return; }
      const to = PATH[this.seg + 1];
      const dx = to.x - this.x, dy = to.y - this.y;
      const d  = Math.hypot(dx, dy);
      if (d < 0.01) { this.seg++; continue; }
      if (rem >= d) {
        this.x = to.x; this.y = to.y;
        this.dist += d; rem -= d; this.seg++;
      } else {
        this.x += (dx/d)*rem; this.y += (dy/d)*rem;
        this.dist += rem; rem = 0;
      }
    }
    if (this.seg >= PATH.length - 1) this.escaped = true;
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) this.dead = true;
  }

  say(txt) { this.speech = txt; this.speechT = 1.6; }
}

// ─── Tower ────────────────────────────────────────────────────────────────
class Tower {
  constructor(type, cx, cy, spotId) {
    const d         = TOWER_TYPES[type];
    this.type       = type;
    this.cx         = cx;
    this.cy         = cy;
    this.spotId     = spotId;
    this.name       = d.name;
    this.level      = 0;
    this.maxLv      = d.upgrades.length;

    this.range      = d.range;
    this.damage     = d.damage;
    this.fireRate   = d.fireRate;
    this.projSpeed  = d.projSpeed;
    this.splashR    = d.splashR || 0;
    this.spawnRate  = d.spawnRate  || 0;
    this.maxSol     = d.maxSoldiers || 0;
    this.solHp      = d.solHp  || 0;
    this.solDmg     = d.solDmg || 0;

    this.fireCd     = 0;
    this.spawnCd    = 0;
    this.soldiers   = [];
    this.flash      = 0;
    this.target     = null;
    this.kills      = 0;
  }

  sellValue() {
    let v = TOWER_TYPES[this.type].cost;
    TOWER_TYPES[this.type].upgrades.slice(0, this.level).forEach(u => v += u.cost);
    return Math.floor(v * 0.6);
  }

  upgradeCost() {
    return this.level < this.maxLv ? TOWER_TYPES[this.type].upgrades[this.level].cost : null;
  }

  doUpgrade() {
    if (this.level >= this.maxLv) return;
    const u = TOWER_TYPES[this.type].upgrades[this.level++];
    if (u.range       !== undefined) this.range      = u.range;
    if (u.damage      !== undefined) this.damage     = u.damage;
    if (u.fireRate    !== undefined) this.fireRate    = u.fireRate;
    if (u.splashR     !== undefined) this.splashR     = u.splashR;
    if (u.spawnRate   !== undefined) this.spawnRate   = u.spawnRate;
    if (u.maxSoldiers !== undefined) this.maxSol      = u.maxSoldiers;
    if (u.solHp       !== undefined) this.solHp       = u.solHp;
    if (u.solDmg      !== undefined) this.solDmg      = u.solDmg;
  }

  update(dt, enemies, projectiles, tMod) {
    this.flash = Math.max(0, this.flash - dt);
    if (this.type === "spawner") { this._updateSpawner(dt, enemies); return; }

    const rateM  = (tMod.rate)  || 1;
    const rangeM = (tMod.range) || 1;
    const dmgM   = (this.type === "cannon" && tMod.cannonDmg) ? tMod.cannonDmg : 1;
    const rng    = this.range * rangeM;
    this.fireCd  = Math.max(0, this.fireCd - dt);
    if (this.fireCd > 0) return;

    // Target: enemy furthest along the path within range
    let best = null, bestD = -1;
    for (const e of enemies) {
      if (e.dead || e.escaped) continue;
      const d2 = (e.x-this.cx)**2 + (e.y-this.cy)**2;
      if (d2 <= rng*rng && e.dist > bestD) { bestD = e.dist; best = e; }
    }
    if (!best) return;

    this.target = best;
    projectiles.push(new Projectile(
      this.cx, this.cy, best,
      Math.floor(this.damage * dmgM),
      this.projSpeed, this.splashR, this.type
    ));
    this.fireCd = (1 / this.fireRate) / rateM;
    this.flash  = 0.09;
  }

  _updateSpawner(dt, enemies) {
    this.soldiers = this.soldiers.filter(s => !s.dead);
    this.spawnCd  = Math.max(0, this.spawnCd - dt);
    if (this.spawnCd <= 0 && this.soldiers.length < this.maxSol) {
      this.soldiers.push(new Soldier(this.cx, this.cy, this.solHp, this.solDmg));
      this.spawnCd = this.spawnRate;
    }
    for (const s of this.soldiers) s.update(dt, enemies);
  }
}

// ─── Projectile ───────────────────────────────────────────────────────────
class Projectile {
  constructor(x, y, target, dmg, speed, splashR, tType) {
    this.x       = x;    this.y      = y;
    this.target  = target;
    this.dmg     = dmg;
    this.speed   = speed;
    this.splashR = splashR;
    this.tType   = tType;
    this.dead    = false;
    this.trail   = [];
  }

  update(dt, enemies) {
    if (this.dead) return;
    if (this.target.dead) { this.dead = true; return; }
    const dx = this.target.x - this.x, dy = this.target.y - this.y;
    const d  = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d <= step + 2) {
      this._hit(enemies);
    } else {
      this.trail.push({x:this.x|0, y:this.y|0});
      if (this.trail.length > 5) this.trail.shift();
      this.x += (dx/d)*step; this.y += (dy/d)*step;
    }
  }

  _hit(enemies) {
    this.dead = true;
    const QUIPS = ["Ouch!","Oof!","Not me!","Nooo!","Help!","Why?!","Rude!","Yikes!"];
    const list = this.splashR > 0
      ? enemies.filter(e => !e.dead && !e.escaped && Math.hypot(e.x-this.x,e.y-this.y) <= this.splashR)
      : [this.target];
    for (const e of list) {
      if (!e.dead && !e.escaped) {
        e.takeDamage(this.dmg);
        if (!e.dead) e.say(QUIPS[Math.floor(Math.random()*QUIPS.length)]);
      }
    }
  }
}

// ─── Soldier ─────────────────────────────────────────────────────────────
class Soldier {
  constructor(x, y, hp, dmg) {
    this.x     = x; this.y     = y;
    this.homeX = x; this.homeY = y;
    this.hp    = hp; this.maxHp = hp;
    this.dmg   = dmg;
    this.speed = 88;
    this.atkR  = 16;
    this.atkCd = 0;
    this.dead  = false;
    this.animT = Math.random() * 6;
  }

  update(dt, enemies) {
    if (this.dead) return;
    this.animT += dt;
    this.atkCd = Math.max(0, this.atkCd - dt);

    let nearest = null, nearD = Infinity;
    for (const e of enemies) {
      if (e.dead || e.escaped) continue;
      const d = Math.hypot(e.x-this.x, e.y-this.y);
      if (d < nearD) { nearD = d; nearest = e; }
    }

    if (!nearest) {
      const hx = this.homeX-this.x, hy = this.homeY-this.y;
      const hd = Math.hypot(hx, hy);
      if (hd > 6) { this.x += (hx/hd)*this.speed*dt; this.y += (hy/hd)*this.speed*dt; }
      return;
    }

    if (nearD <= this.atkR) {
      if (this.atkCd <= 0) { nearest.takeDamage(this.dmg); this.atkCd = 0.85; }
    } else {
      const dx = nearest.x-this.x, dy = nearest.y-this.y;
      this.x += (dx/nearD)*this.speed*dt; this.y += (dy/nearD)*this.speed*dt;
    }
  }

  takeDamage(dmg) { this.hp = Math.max(0,this.hp-dmg); if(this.hp<=0) this.dead=true; }
}

// ─── Particle ────────────────────────────────────────────────────────────
class Particle {
  constructor(x, y, vx, vy, color, life, size=2) {
    this.x=x; this.y=y; this.vx=vx; this.vy=vy;
    this.color=color; this.life=life; this.maxLife=life; this.size=size; this.dead=false;
  }
  update(dt) {
    this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=80*dt;
    this.life-=dt; if(this.life<=0) this.dead=true;
  }
}

// ─── FloatingText ─────────────────────────────────────────────────────────
class FloatingText {
  constructor(x, y, txt, color="#ffee00") {
    this.x=x; this.y=y; this.txt=txt; this.color=color; this.life=1.4; this.dead=false;
  }
  update(dt) { this.y-=28*dt; this.life-=dt; if(this.life<=0) this.dead=true; }
}
