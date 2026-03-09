"use strict";
// ─── Enemy ────────────────────────────────────────────────────────────────
class Enemy {
  constructor(type, waveNum, mods) {
    const d   = ENEMY_TYPES[type];
    this.type = type;
    this.name = d.name;

    // ── Wave scaling: HP grows +12% per wave; speed caps at +40% (wave 100+) ──
    const hpMult  = 1 + (waveNum - 1) * 0.12;
    const spdMult = 1 + Math.min(waveNum - 1, 100) * 0.004;
    this.maxHp   = Math.floor(d.hp * hpMult * (mods.hp || 1));
    this.hp      = this.maxHp;
    this.speed   = d.speed * spdMult * (mods.speed || 1);
    // Gold reward scales logarithmically so late waves still feel rewarding
    this.reward  = Math.floor(d.reward * (1 + Math.log(waveNum + 1) * 0.5) * (mods.reward || 1));

    this.size    = d.size;
    this.color   = d.color;
    this.flies   = d.flies  || false;
    this.wobAmt  = d.wobble || 0;
    this.isBoss  = d.isBoss || false;

    // ── Path tracking ────────────────────────────────────────────────────
    this.seg  = 0;
    this.x    = PATH[0].x;
    this.y    = PATH[0].y;
    this.dist = 0;

    // ── Status effects (applied/refreshed each frame by towers) ──────────
    this.stunTime   = 0;   // seconds remaining stunned
    this.poisonDps  = 0;   // poison damage per second
    this.poisonRem  = 0;   // seconds of poison remaining
    this.slowFactor = 1.0; // multiplier applied this frame (reset to 1 after move)
    this.goldenMod  = 1.0; // gold multiplier from Golden Tower aura

    // ── Visuals ──────────────────────────────────────────────────────────
    this.wobOff  = 0;
    this.animT   = Math.random() * Math.PI * 2;
    this.dead    = false;
    this.escaped = false;
    this.speech  = "";
    this.speechT = 0;
  }

  update(dt) {
    if (this.dead || this.escaped) return;
    this.animT += dt;
    if (this.wobAmt) this.wobOff = Math.sin(this.animT * 2.8) * this.wobAmt;

    // Stun: frozen in place
    if (this.stunTime > 0) {
      this.stunTime = Math.max(0, this.stunTime - dt);
      if (this.speechT > 0) this.speechT -= dt;
      return;
    }

    // Poison DoT
    if (this.poisonRem > 0) {
      this.poisonRem -= dt;
      this.takeDamage(this.poisonDps * dt);
      if (this.poisonRem <= 0) { this.poisonDps = 0; this.poisonRem = 0; }
    }

    // Move — apply slow factor set by Chrono aura
    this._move(this.speed * this.slowFactor * dt);
    // Reset per-frame modifiers (aura towers re-apply them each frame)
    this.slowFactor = 1.0;
    this.goldenMod  = 1.0;

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
        this.x += (dx / d) * rem; this.y += (dy / d) * rem;
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
    const d      = TOWER_TYPES[type];
    this.type    = type;
    this.cx      = cx;
    this.cy      = cy;
    this.spotId  = spotId;
    this.name    = d.name;
    this.level   = 0;      // 0 = base, max 999

    // ── Base stats (copied from config) ───────────────────────────────────
    this.range     = d.range;
    this.damage    = d.damage;
    this.fireRate  = d.fireRate;
    this.projSpeed = d.projSpeed;
    this.splashR   = d.splashR   || 0;
    this.spawnRate = d.spawnRate || 0;
    this.maxSol    = d.maxSoldiers || 0;
    this.solHp     = d.solHp     || 0;
    this.solDmg    = d.solDmg    || 0;

    // ── Special mechanics ─────────────────────────────────────────────────
    this.stunDur   = d.stunDur   || 0;
    this.poisonDps = d.poisonDps || 0;
    this.poisonDur = d.poisonDur || 0;
    this.pullForce = d.pullForce || 0;
    this.isAura    = d.isAura    || false;
    this.auraType  = d.auraType  || null;
    this.pierce    = d.pierce    || false;
    this.multiShot = d.multiShot || 1;
    this.minWave   = d.minWave   || 0;

    // ── Runtime state ─────────────────────────────────────────────────────
    this.fireCd    = 0;
    this.spawnCd   = 0;
    this.soldiers  = [];
    this.flash     = 0;
    this.auraPulse = 0;
    this.buffed    = false; // set each frame by Axe aura pre-pass
    this.target    = null;
    this.kills     = 0;
  }

  // ── Upgrade cost formula: exponential so level 999 costs huge gold ────
  upgradeCost() {
    if (this.level >= 999) return null;
    return Math.floor(TOWER_TYPES[this.type].cost * 0.6 * Math.pow(1.11, this.level));
  }

  // ── Sell: refund 60% of total gold invested ───────────────────────────
  sellValue() {
    const d = TOWER_TYPES[this.type];
    let total = d.cost;
    for (let i = 0; i < this.level; i++) {
      total += Math.floor(d.cost * 0.6 * Math.pow(1.11, i));
    }
    return Math.floor(total * 0.6);
  }

  // ── Apply formula-based stat increase for this level ─────────────────
  doUpgrade() {
    if (this.level >= 999) return;
    this.level++;
    const d  = TOWER_TYPES[this.type];
    const ub = d.upgBase;
    const lv = this.level;

    // Power-law scaling with diminishing returns:
    //   lv1:~1.10x  lv10:~1.50x  lv50:~2.30x  lv100:~3.30x  lv999:~9.5x
    const statM  = 1 + 0.10 * Math.pow(lv, 0.65);
    const rangeM = 1 + 0.04 * Math.pow(lv, 0.55);
    const rateM  = 1 + 0.08 * Math.pow(lv, 0.60);

    if (ub.damage   > 0) this.damage    = Math.ceil(ub.damage   * statM);
    if (ub.range    > 0) this.range     = Math.ceil(ub.range    * rangeM);
    if (ub.fireRate > 0) this.fireRate  = +(ub.fireRate * rateM).toFixed(3);
    if (ub.splashR  > 0) this.splashR   = Math.ceil(ub.splashR  * (1 + 0.03 * Math.pow(lv, 0.5)));

    if (d.spawnRate > 0) {
      this.spawnRate = Math.max(0.5, ub.spawnRate / rateM);
      this.maxSol    = Math.min(20, ub.maxSoldiers + Math.floor(lv / 5));
      this.solHp     = Math.ceil(ub.solHp  * statM);
      this.solDmg    = Math.ceil(ub.solDmg * statM);
    }
    if (d.stunDur   > 0) this.stunDur   = Math.min(d.stunDur * (1 + 0.02 * Math.pow(lv, 0.5)), 8);
    if (d.poisonDps > 0) {
      this.poisonDps = +(ub.poisonDps * statM).toFixed(2);
      this.poisonDur = +(ub.poisonDur * (1 + 0.02 * Math.pow(lv, 0.5))).toFixed(2);
    }
    if (d.pullForce > 0) this.pullForce = +(ub.pullForce * statM).toFixed(1);
    if (d.isAura)        this.range     = Math.ceil(ub.range * rangeM);
  }

  // ── Main update ───────────────────────────────────────────────────────
  update(dt, enemies, projectiles, tMod) {
    this.flash      = Math.max(0, this.flash - dt);
    this.auraPulse += dt;
    if (this.type === "spawner") { this._updateSpawner(dt, enemies); return; }
    if (this.isAura)             { this._updateAura(dt, enemies, tMod); return; }

    const rateM  = tMod.rate  || 1;
    const rangeM = tMod.range || 1;
    // Composite damage multiplier: global + cannon bonus + axe buff
    const dmgM   = (tMod.dmgMult     || 1) *
                   (this.type === "cannon" && tMod.cannonDmg ? tMod.cannonDmg : 1) *
                   (this.buffed ? 1.35 : 1);
    const poisonM = tMod.poisonMult && this.type === "poison" ? tMod.poisonMult : 1;

    const rng = this.range * rangeM;
    this.fireCd = Math.max(0, this.fireCd - dt);
    if (this.fireCd > 0) return;

    // Target: furthest along path within range
    let best = null, bestDist = -1;
    for (const e of enemies) {
      if (e.dead || e.escaped) continue;
      if ((e.x - this.cx) ** 2 + (e.y - this.cy) ** 2 <= rng * rng && e.dist > bestDist) {
        bestDist = e.dist; best = e;
      }
    }
    if (!best) return;

    this.target = best;
    const finalDmg = Math.floor(this.damage * dmgM);

    // Smart Missiles fire at multiple targets
    const targets = this.multiShot > 1
      ? enemies
          .filter(e => !e.dead && !e.escaped &&
                       (e.x - this.cx) ** 2 + (e.y - this.cy) ** 2 <= rng * rng)
          .sort((a, b) => b.dist - a.dist)
          .slice(0, this.multiShot)
      : [best];

    for (const tgt of targets) {
      projectiles.push(new Projectile(
        this.cx, this.cy, tgt,
        finalDmg, this.projSpeed, this.splashR, this.type,
        this.stunDur,
        this.poisonDps * poisonM, this.poisonDur,
        this.pierce, enemies
      ));
    }
    this.fireCd = (1 / this.fireRate) / rateM;
    this.flash  = 0.09;
  }

  // ── Aura towers affect enemies directly ───────────────────────────────
  _updateAura(dt, enemies, tMod) {
    const rng = this.range * (tMod.range || 1);

    if (this.auraType === "pull") {
      // Black Hole: pull enemies + periodic area damage
      this.fireCd = Math.max(0, this.fireCd - dt);
      for (const e of enemies) {
        if (e.dead || e.escaped) continue;
        const dx = this.cx - e.x, dy = this.cy - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= rng) {
          if (dist > 1) {
            e.x += (dx / dist) * this.pullForce * dt;
            e.y += (dy / dist) * this.pullForce * dt;
          }
          if (this.fireCd <= 0) e.takeDamage(this.damage);
        }
      }
      if (this.fireCd <= 0) { this.fireCd = 1 / this.fireRate; this.flash = 0.05; }
    }

    if (this.auraType === "slow") {
      // Chrono Field: mark enemy slowFactor (enemy uses it before resetting)
      const sf = TOWER_TYPES.chrono.slowFactor;
      for (const e of enemies) {
        if (e.dead || e.escaped) continue;
        if ((e.x - this.cx) ** 2 + (e.y - this.cy) ** 2 <= rng * rng) {
          e.slowFactor = Math.min(e.slowFactor, sf);
        }
      }
    }

    if (this.auraType === "gold") {
      // Golden Tower: mark enemies for bonus gold multiplier
      for (const e of enemies) {
        if (e.dead || e.escaped) continue;
        if ((e.x - this.cx) ** 2 + (e.y - this.cy) ** 2 <= rng * rng) {
          e.goldenMod = Math.max(e.goldenMod, 1.6);
        }
      }
    }
    // "buff" (Axe) is handled in the game.js pre-pass, not here
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
  constructor(x, y, target, dmg, speed, splashR, tType,
              stunDur, poisonDps, poisonDur, pierce, allEnemies) {
    this.x        = x;      this.y        = y;
    this.target   = target;
    this.dmg      = dmg;
    this.speed    = speed;
    this.splashR  = splashR;
    this.tType    = tType;
    this.stunDur  = stunDur  || 0;
    this.poisonDps= poisonDps|| 0;
    this.poisonDur= poisonDur|| 0;
    this.pierce   = pierce   || false;
    this.allEnemies = allEnemies || [];
    this.dead     = false;
    this.trail    = [];
  }

  update(dt) {
    if (this.dead) return;
    if (this.target.dead) { this.dead = true; return; }
    const dx = this.target.x - this.x, dy = this.target.y - this.y;
    const d  = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d <= step + 2) {
      this._hit();
    } else {
      this.trail.push({ x: this.x | 0, y: this.y | 0 });
      if (this.trail.length > 6) this.trail.shift();
      this.x += (dx / d) * step; this.y += (dy / d) * step;
    }
  }

  _hit() {
    this.dead = true;
    const QUIPS = ["Ouch!", "Oof!", "Not me!", "Nooo!", "Help!", "Why?!", "Rude!", "Yikes!", "Bruh!"];
    const list = this.splashR > 0
      ? this.allEnemies.filter(e => !e.dead && !e.escaped &&
          Math.hypot(e.x - this.x, e.y - this.y) <= this.splashR)
      : [this.target];

    for (const e of list) {
      if (e.dead || e.escaped) continue;
      e.takeDamage(this.dmg);
      if (this.stunDur > 0 && !e.dead) {
        e.stunTime = Math.max(e.stunTime, this.stunDur);
        e.say("💫 Stunned!");
      } else if (this.poisonDps > 0 && !e.dead) {
        // Refresh poison if new one is stronger
        if (this.poisonDps > e.poisonDps) e.poisonDps = this.poisonDps;
        e.poisonRem = Math.max(e.poisonRem, this.poisonDur);
        e.say("☠ Poisoned!");
      } else if (!e.dead) {
        e.say(QUIPS[Math.floor(Math.random() * QUIPS.length)]);
      }
    }

    // Piercing (Prototype): continue to next enemy in line
    if (this.pierce && this.target.dead) {
      const next = this.allEnemies
        .filter(e => !e.dead && !e.escaped && e !== this.target)
        .sort((a, b) => {
          const da = (a.x - this.x) ** 2 + (a.y - this.y) ** 2;
          const db = (b.x - this.x) ** 2 + (b.y - this.y) ** 2;
          return da - db;
        })[0];
      if (next && Math.hypot(next.x - this.x, next.y - this.y) < 80) {
        this.dead   = false;
        this.target = next;
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
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < nearD) { nearD = d; nearest = e; }
    }

    if (!nearest) {
      const hx = this.homeX - this.x, hy = this.homeY - this.y;
      const hd = Math.hypot(hx, hy);
      if (hd > 6) { this.x += (hx / hd) * this.speed * dt; this.y += (hy / hd) * this.speed * dt; }
      return;
    }

    if (nearD <= this.atkR) {
      if (this.atkCd <= 0) { nearest.takeDamage(this.dmg); this.atkCd = 0.85; }
    } else {
      const dx = nearest.x - this.x, dy = nearest.y - this.y;
      this.x += (dx / nearD) * this.speed * dt;
      this.y += (dy / nearD) * this.speed * dt;
    }
  }

  takeDamage(dmg) { this.hp = Math.max(0, this.hp - dmg); if (this.hp <= 0) this.dead = true; }
}

// ─── Particle ────────────────────────────────────────────────────────────
class Particle {
  constructor(x, y, vx, vy, color, life, size = 2) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.life = life; this.maxLife = life;
    this.size = size; this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 80 * dt;
    this.life -= dt; if (this.life <= 0) this.dead = true;
  }
}

// ─── FloatingText ────────────────────────────────────────────────────────
class FloatingText {
  constructor(x, y, txt, color = "#ffee00") {
    this.x = x; this.y = y; this.txt = txt; this.color = color;
    this.life = 1.4; this.dead = false;
  }
  update(dt) { this.y -= 28 * dt; this.life -= dt; if (this.life <= 0) this.dead = true; }
}
