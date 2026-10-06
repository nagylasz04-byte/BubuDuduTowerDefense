"use strict";

/* =========================================================
   BUBU & DUDU vs KAJA SZÖRNYEK
   Egyszerű tower-defense stílusú böngésző játék.
   ========================================================= */

/* ---------- ALAP KONFIG ---------- */
const ROWS = 5;
const COLS = 9;
const CANVAS_W = 900;
const CANVAS_H = 560;
const HOUSE_W = 70;                 // ház sáv szélessége balra
const CELL_W = (CANVAS_W - HOUSE_W) / COLS;
const CELL_H = CANVAS_H / ROWS;
const LAWNMOWER_X = HOUSE_W - 10;

const SAVE_KEY = "bubuDuduSave_v1";

/* ---------- VÉDŐ EGYSÉGEK ---------- */
const UNITS = {
  bubu_shooter: {
    id: "bubu_shooter", name: "Bubu Lövő", emoji: "🐻", badge: "🍏",
    cost: 50, hp: 100, dmg: 20, rate: 1100, cooldown: 5000,
    bg: "#f3c98a", desc: "Vitamingolyót lő a szörnyekre."
  },
  dudu_wall: {
    id: "dudu_wall", name: "Dudu Pajzs", emoji: "🐼", badge: "🛡️",
    cost: 25, hp: 380, dmg: 0, rate: 0, cooldown: 9000,
    bg: "#e8e8e8", desc: "Erős fal, elnyeli az ütéseket."
  },
  bubu_sun: {
    id: "bubu_sun", name: "Bubu Energia", emoji: "🐻", badge: "⭐",
    cost: 25, hp: 60, dmg: 0, rate: 0, cooldown: 8000,
    energyAmount: 25, energyRate: 6000,
    bg: "#ffe08a", desc: "Energiát termel időnként."
  },
  dudu_slow: {
    id: "dudu_slow", name: "Dudu Fagyi", emoji: "🐼", badge: "❄️",
    cost: 100, hp: 100, dmg: 8, rate: 1400, cooldown: 12000,
    slowFactor: 0.5, slowDuration: 3000,
    bg: "#a6d8ff", desc: "Lelassítja a szörnyeket."
  },
  bubu_bomb: {
    id: "bubu_bomb", name: "Bubu Bomba", emoji: "🐻", badge: "💥",
    cost: 150, hp: 1, dmg: 480, cooldown: 20000, fuse: 1600,
    oneShot: true, splash: true,
    bg: "#f4a37c", desc: "Hatalmas robbanás egy területen."
  },
  dudu_trap: {
    id: "dudu_trap", name: "Dudu Csapda", emoji: "🐼", badge: "🍯",
    cost: 75, hp: 1, dmg: 320, cooldown: 11000,
    oneShot: true, trap: true,
    bg: "#dda15e", desc: "Elrejtőzik, majd lecsap a közeledőre."
  }
};
const UNIT_ORDER = ["bubu_sun", "bubu_shooter", "dudu_wall", "dudu_slow", "dudu_trap", "bubu_bomb"];

/* ---------- ELLENFÉL TÍPUSOK ---------- */
const ENEMIES = {
  hamburger: { name: "Hamburger Manó", emoji: "🍔", hp: 80, speed: 20, dmg: 10, rate: 900 },
  taco:      { name: "Taco Fürge",     emoji: "🌮", hp: 55, speed: 34, dmg: 8,  rate: 800 },
  donut:     { name: "Fánk Óriás",     emoji: "🍩", hp: 160, speed: 16, dmg: 14, rate: 1000 },
  fries:     { name: "Sültkrumpli Pajzsos", emoji: "🍟", hp: 240, speed: 13, dmg: 12, rate: 1000 },
  soda:      { name: "Kólabuborék",    emoji: "🥤", hp: 110, speed: 40, dmg: 10, rate: 800 },
  cake:      { name: "Csokitorta Behemót", emoji: "🍰", hp: 420, speed: 11, dmg: 20, rate: 1200 },
  boss:      { name: "Király Burger",  emoji: "👑", hp: 3000, speed: 9, dmg: 30, rate: 1000, boss: true, summonEvery: 9000 }
};

/* ---------- PÁLYÁK ---------- */
const LEVELS = [
  { num: 1, name: "Kerti barangolás", startEnergy: 200, count: 12, pool: ["hamburger", "taco"], gapMin: 3800, gapMax: 5800, boss: false },
  { num: 2, name: "Konyhai csata", startEnergy: 220, count: 16, pool: ["hamburger", "taco", "donut"], gapMin: 3400, gapMax: 5200, boss: false },
  { num: 3, name: "Édesség özön", startEnergy: 240, count: 20, pool: ["hamburger", "taco", "donut", "fries"], gapMin: 3000, gapMax: 4800, boss: false },
  { num: 4, name: "Gyorsétterem roham", startEnergy: 260, count: 24, pool: ["taco", "donut", "fries", "soda"], gapMin: 2600, gapMax: 4200, boss: false },
  { num: 5, name: "A Burger Király", startEnergy: 300, count: 22, pool: ["donut", "fries", "soda", "cake"], gapMin: 2400, gapMax: 3800, boss: true }
];

/* ---------- MENTÉS ---------- */
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt save */ }
  return { unlocked: 1 };
}
function saveSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
}
let save = loadSave();

/* ---------- KIS SEGÉDEK ---------- */
function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rowCenterY(row) { return row * CELL_H + CELL_H / 2; }
function colCenterX(col) { return HOUSE_W + col * CELL_W + CELL_W / 2; }

/* =========================================================
   ÁLLAPOTGÉP / KÉPERNYŐK
   ========================================================= */
const screens = {
  start: document.getElementById("screen-start"),
  howto: document.getElementById("screen-howto"),
  levels: document.getElementById("screen-levels"),
  game: document.getElementById("screen-game")
};
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function buildLevelGrid() {
  const grid = document.getElementById("level-grid");
  grid.innerHTML = "";
  LEVELS.forEach(lv => {
    const locked = lv.num > save.unlocked;
    const card = document.createElement("div");
    card.className = "level-card" + (locked ? " locked" : "");
    const stars = save["stars_" + lv.num] || 0;
    card.innerHTML = `<div class="lvl-num">${lv.num}</div>
      <div>${lv.name}</div>
      <div class="lvl-stars">${locked ? "" : "⭐".repeat(stars) + "☆".repeat(3 - stars)}</div>`;
    if (!locked) card.addEventListener("click", () => startLevel(lv.num));
    grid.appendChild(card);
  });
}

document.getElementById("btn-play").addEventListener("click", () => { buildLevelGrid(); showScreen("levels"); });
document.getElementById("btn-howto").addEventListener("click", () => showScreen("howto"));
document.getElementById("btn-howto-back").addEventListener("click", () => showScreen("start"));
document.getElementById("btn-levels-back").addEventListener("click", () => showScreen("start"));
document.getElementById("btn-quit").addEventListener("click", () => { hideOverlays(); stopGame(); buildLevelGrid(); showScreen("levels"); });
document.getElementById("btn-win-menu").addEventListener("click", () => { hideOverlays(); stopGame(); buildLevelGrid(); showScreen("levels"); });
document.getElementById("btn-lose-menu").addEventListener("click", () => { hideOverlays(); stopGame(); buildLevelGrid(); showScreen("levels"); });
document.getElementById("btn-lose-retry").addEventListener("click", () => { hideOverlays(); startLevel(state.levelNum); });
document.getElementById("btn-win-next").addEventListener("click", () => {
  hideOverlays();
  const next = state.levelNum + 1;
  if (next <= LEVELS.length) startLevel(next);
  else { stopGame(); buildLevelGrid(); showScreen("levels"); }
});
document.getElementById("btn-restart").addEventListener("click", () => { hideOverlays(); startLevel(state.levelNum); });
document.getElementById("btn-resume").addEventListener("click", () => togglePause(false));
document.getElementById("btn-pause").addEventListener("click", () => togglePause(!state.paused));

function hideOverlays() {
  document.querySelectorAll(".overlay").forEach(o => o.classList.remove("active"));
}
function showOverlay(id) { document.getElementById(id).classList.add("active"); }

/* =========================================================
   JÁTÉK ÁLLAPOT
   ========================================================= */
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let state = null;   // aktuális futó pálya állapota
let rafId = null;
let lastTs = 0;

function freshState(levelNum) {
  const cfg = LEVELS[levelNum - 1];
  return {
    levelNum,
    cfg,
    energy: cfg.startEnergy,
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    defenders: [],
    enemies: [],
    projectiles: [],
    collectibles: [],
    explosions: [],
    lawnUsed: Array(ROWS).fill(false),
    lawnAnim: Array(ROWS).fill(0), // >0 animálja a seprűt
    spawnSchedule: [],
    spawnedCount: 0,
    elapsed: 0,
    nextCollectible: rand(4000, 7000),
    selectedUnit: null,
    cooldowns: {},
    paused: false,
    over: false,
    won: false,
    milestonesHit: {}
  };
}

function generateSchedule(cfg) {
  const events = [];
  let t = 2200;
  for (let i = 0; i < cfg.count; i++) {
    const row = Math.floor(Math.random() * ROWS);
    // nehezítés: a pálya második felében inkább az erősebb pool-vég felől válogat
    const bias = i / cfg.count;
    let type;
    if (Math.random() < 0.35 + bias * 0.3 && cfg.pool.length > 1) {
      const idx = Math.min(cfg.pool.length - 1, Math.floor(bias * cfg.pool.length + Math.random()));
      type = cfg.pool[idx];
    } else {
      type = pick(cfg.pool);
    }
    events.push({ t, row, type });
    const speedUp = 1 - bias * 0.25;
    t += rand(cfg.gapMin, cfg.gapMax) * speedUp;
  }
  if (cfg.boss) {
    events.push({ t: t + 2500, row: 2, type: "boss" });
  }
  return events;
}

/* ---------- PÁLYA INDÍTÁS ---------- */
function startLevel(levelNum) {
  hideOverlays();
  state = freshState(levelNum);
  state.spawnSchedule = generateSchedule(state.cfg);
  document.getElementById("level-num").textContent = levelNum;
  buildShopBar();
  updateHud();
  showScreen("game");
  lastTs = performance.now();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}
function stopGame() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  state = null;
}
function togglePause(p) {
  if (!state) return;
  state.paused = p;
  if (p) showOverlay("overlay-pause"); else { hideOverlays(); lastTs = performance.now(); }
}

/* =========================================================
   SHOP BAR
   ========================================================= */
function buildShopBar() {
  const bar = document.getElementById("shop-bar");
  bar.innerHTML = "";
  UNIT_ORDER.forEach(id => {
    const u = UNITS[id];
    const card = document.createElement("div");
    card.className = "shop-card";
    card.dataset.id = id;
    card.innerHTML = `
      <div class="sc-emoji" style="background:${u.bg}; border-radius:10px;">${u.emoji}<span class="sc-badge">${u.badge}</span></div>
      <div class="sc-cost">🍏${u.cost}</div>
    `;
    card.addEventListener("click", () => selectUnit(id));
    bar.appendChild(card);
  });
}
function selectUnit(id) {
  if (!state || state.paused) return;
  const u = UNITS[id];
  const onCd = state.cooldowns[id] && state.cooldowns[id] > 0;
  if (onCd || state.energy < u.cost) return;
  state.selectedUnit = (state.selectedUnit === id) ? null : id;
  refreshShopSelection();
}
function refreshShopSelection() {
  document.querySelectorAll(".shop-card").forEach(card => {
    card.classList.toggle("selected", card.dataset.id === state.selectedUnit);
  });
}
function updateShopAffordability() {
  document.querySelectorAll(".shop-card").forEach(card => {
    const id = card.dataset.id;
    const u = UNITS[id];
    const cd = state.cooldowns[id] || 0;
    let cdEl = card.querySelector(".sc-cooldown");
    if (cd > 0) {
      if (!cdEl) {
        cdEl = document.createElement("div");
        cdEl.className = "sc-cooldown";
        card.appendChild(cdEl);
      }
      cdEl.textContent = Math.ceil(cd / 1000) + "s";
      card.classList.add("disabled");
    } else {
      if (cdEl) cdEl.remove();
      card.classList.toggle("disabled", state.energy < u.cost);
    }
  });
}

/* =========================================================
   HUD
   ========================================================= */
function updateHud() {
  document.getElementById("energy-count").textContent = Math.floor(state.energy);
  const pct = clamp((state.spawnedCount / state.cfg.count) * 100, 0, 100);
  document.getElementById("hud-progress-bar").style.width = pct + "%";
}

/* =========================================================
   BANNER / LEBEGŐ SZÖVEG
   ========================================================= */
function showBanner(text) {
  const layer = document.getElementById("banner-layer");
  const el = document.createElement("div");
  el.className = "banner";
  el.textContent = text;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
function floatText(x, y, text, color) {
  const wrap = document.getElementById("canvas-wrap");
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / CANVAS_W;
  const scaleY = rect.height / CANVAS_H;
  const el = document.createElement("div");
  el.className = "float-text";
  el.textContent = text;
  el.style.left = (x * scaleX) + "px";
  el.style.top = (y * scaleY) + "px";
  if (color) el.style.color = color;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

/* =========================================================
   CANVAS KATTINTÁS -> RÁCS / GYŰJTHETŐ
   ========================================================= */
canvas.addEventListener("click", (ev) => {
  if (!state || state.paused || state.over) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_W / rect.width;
  const scaleY = CANVAS_H / rect.height;
  const x = (ev.clientX - rect.left) * scaleX;
  const y = (ev.clientY - rect.top) * scaleY;

  // gyűjthető energia?
  for (let i = state.collectibles.length - 1; i >= 0; i--) {
    const c = state.collectibles[i];
    const dx = x - c.x, dy = y - c.y;
    if (dx * dx + dy * dy < 32 * 32) {
      state.energy += c.amount;
      floatText(c.x, c.y, "+" + c.amount + " 🍏", "#5aa66b");
      state.collectibles.splice(i, 1);
      updateHud();
      return;
    }
  }

  if (x < HOUSE_W) return; // ház sávra nem lehet telepíteni
  if (!state.selectedUnit) return;
  const col = Math.floor((x - HOUSE_W) / CELL_W);
  const row = Math.floor(y / CELL_H);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
  placeDefender(row, col, state.selectedUnit);
});

function placeDefender(row, col, unitId) {
  const u = UNITS[unitId];
  if (state.grid[row][col]) return;
  if (state.energy < u.cost) return;
  if (state.cooldowns[unitId] && state.cooldowns[unitId] > 0) return;

  const def = {
    id: unitId, u, row, col,
    x: colCenterX(col), y: rowCenterY(row),
    hp: u.hp, maxHp: u.hp,
    fireCd: rand(0, 300),
    energyCd: u.energyRate ? rand(1000, u.energyRate) : 0,
    fuseLeft: u.fuse || 0,
    triggered: false,
    slowResist: 0
  };
  state.grid[row][col] = def;
  state.defenders.push(def);
  state.energy -= u.cost;
  state.cooldowns[unitId] = u.cooldown;
  state.selectedUnit = null;
  refreshShopSelection();
  updateHud();
}

/* =========================================================
   FŐ CIKLUS
   ========================================================= */
function loop(ts) {
  if (!state) return;
  let dt = ts - lastTs;
  lastTs = ts;
  if (dt > 100) dt = 100; // tabváltás védelem
  if (!state.paused && !state.over) {
    update(dt);
  }
  render();
  rafId = requestAnimationFrame(loop);
}

function update(dt) {
  state.elapsed += dt;

  // védők cooldownjai (bolt)
  for (const id in state.cooldowns) {
    if (state.cooldowns[id] > 0) state.cooldowns[id] = Math.max(0, state.cooldowns[id] - dt);
  }

  spawnFromSchedule();
  updateCollectibles(dt);
  updateDefenders(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateExplosions(dt);
  checkWinLose();
  updateHud();
  updateShopAffordability();
}

/* ---------- SPAWN ÜTEMEZÉS ---------- */
function spawnFromSchedule() {
  while (state.spawnSchedule.length && state.spawnSchedule[0].t <= state.elapsed) {
    const ev = state.spawnSchedule.shift();
    spawnEnemy(ev.row, ev.type);
    state.spawnedCount++;

    const pct = state.spawnedCount / state.cfg.count;
    if (ev.type === "boss") {
      showBanner("👑 A BURGER KIRÁLY ÉRKEZIK! 👑");
    } else if (pct >= 0.5 && !state.milestonesHit.half) {
      state.milestonesHit.half = true;
      showBanner("🌊 Félidő a hullámban!");
    } else if (state.spawnSchedule.length === 0 && !state.cfg.boss) {
      showBanner("⚠️ Utolsó szörny beérkezett!");
    }
  }
}

function spawnEnemy(row, type) {
  const base = ENEMIES[type];
  state.enemies.push({
    type, row, base,
    x: CANVAS_W + rand(0, 40),
    y: rowCenterY(row),
    hp: base.hp, maxHp: base.hp,
    speed: base.speed,
    dmg: base.dmg,
    rate: base.rate,
    atkCd: 0,
    slowUntil: 0,
    slowFactor: 1,
    summonCd: base.summonEvery || 0
  });
}

/* ---------- GYŰJTHETŐ ENERGIA ---------- */
function updateCollectibles(dt) {
  state.nextCollectible -= dt;
  if (state.nextCollectible <= 0) {
    state.nextCollectible = rand(7000, 11000);
    const row = Math.floor(Math.random() * ROWS);
    const col = Math.floor(Math.random() * COLS);
    state.collectibles.push({
      x: colCenterX(col), y: rowCenterY(row) - 20,
      amount: 25, life: 6500, born: state.elapsed
    });
  }
  for (let i = state.collectibles.length - 1; i >= 0; i--) {
    const c = state.collectibles[i];
    if (state.elapsed - c.born > c.life) state.collectibles.splice(i, 1);
  }
}

/* ---------- VÉDŐK LOGIKÁJA ---------- */
function updateDefenders(dt) {
  for (let i = state.defenders.length - 1; i >= 0; i--) {
    const d = state.defenders[i];
    const u = d.u;

    // energiatermelő
    if (u.energyAmount) {
      d.energyCd -= dt;
      if (d.energyCd <= 0) {
        d.energyCd = u.energyRate;
        state.energy += u.energyAmount;
        floatText(d.x, d.y - 20, "+" + u.energyAmount + " 🍏", "#5aa66b");
      }
    }

    // csapda (trap): amikor ellenfél elér a mezőjéig
    if (u.trap && !d.triggered) {
      const enemy = state.enemies.find(e => e.row === d.row && Math.abs(e.x - d.x) < CELL_W * 0.55);
      if (enemy) {
        d.triggered = true;
        damageEnemy(enemy, u.dmg);
        spawnExplosion(d.x, d.y, "#dda15e");
        removeDefender(d);
        continue;
      }
    }

    // bomba (oneShot, fuse alapú)
    if (u.oneShot && u.splash && !d.triggered) {
      d.fuseLeft -= dt;
      if (d.fuseLeft <= 0) {
        d.triggered = true;
        const rowsToHit = [d.row - 1, d.row, d.row + 1].filter(r => r >= 0 && r < ROWS);
        for (const e of state.enemies) {
          if (rowsToHit.includes(e.row) && Math.abs(e.x - d.x) < CELL_W * 1.6) {
            damageEnemy(e, u.dmg);
          }
        }
        spawnExplosion(d.x, d.y, "#e76f51");
        removeDefender(d);
        continue;
      }
    }

    // sima lövő / lassító
    if (u.dmg > 0 && !u.trap) {
      d.fireCd -= dt;
      if (d.fireCd <= 0) {
        const target = state.enemies
          .filter(e => e.row === d.row && e.x > d.x)
          .sort((a, b) => a.x - b.x)[0];
        if (target) {
          d.fireCd = u.rate;
          state.projectiles.push({
            x: d.x + 18, y: d.y, row: d.row,
            speed: 420, dmg: u.dmg,
            slow: u.slowFactor ? { factor: u.slowFactor, duration: u.slowDuration } : null,
            color: u.id === "dudu_slow" ? "#a6d8ff" : "#ffd166"
          });
        }
      }
    }
  }
}

function removeDefender(d) {
  const idx = state.defenders.indexOf(d);
  if (idx >= 0) state.defenders.splice(idx, 1);
  state.grid[d.row][d.col] = null;
}

/* ---------- LÖVEDÉKEK ---------- */
function updateProjectiles(dt) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.x += p.speed * dt / 1000;
    if (p.x > CANVAS_W + 20) { state.projectiles.splice(i, 1); continue; }
    const hit = state.enemies.find(e => e.row === p.row && Math.abs(e.x - p.x) < 22);
    if (hit) {
      damageEnemy(hit, p.dmg);
      if (p.slow) {
        hit.slowUntil = state.elapsed + p.slow.duration;
        hit.slowFactor = p.slow.factor;
      }
      state.projectiles.splice(i, 1);
    }
  }
}

/* ---------- ELLENFELEK ---------- */
function updateEnemies(dt) {
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];

    if (e.hp <= 0) {
      spawnExplosion(e.x, e.y, "#ffb703");
      state.enemies.splice(i, 1);
      continue;
    }

    // boss minion nyár
    if (e.base.boss) {
      e.summonCd -= dt;
      if (e.summonCd <= 0) {
        e.summonCd = e.base.summonEvery;
        const r = clamp(e.row + (Math.random() < 0.5 ? -1 : 1), 0, ROWS - 1);
        spawnEnemy(r, "hamburger");
        showBanner("👑 A Király erősítést hívott!");
      }
    }

    const curSlow = (e.slowUntil > state.elapsed) ? e.slowFactor : 1;

    // ütközés védővel ugyanabban a sorban?
    const blocker = state.grid[e.row].reduce((found, cellDef, colIdx) => {
      if (found) return found;
      if (cellDef && Math.abs(cellDef.x - e.x) < (CELL_W * 0.5 + 14)) return cellDef;
      return null;
    }, null);

    if (blocker) {
      e.atkCd -= dt;
      if (e.atkCd <= 0) {
        e.atkCd = e.rate;
        blocker.hp -= e.dmg;
        floatText(blocker.x, blocker.y - 26, "-" + e.dmg, "#e63946");
        if (blocker.hp <= 0) {
          spawnExplosion(blocker.x, blocker.y, "#e63946");
          removeDefender(blocker);
        }
      }
      continue; // nem mozog, amíg harcol
    }

    // mozgás balra
    e.x -= e.speed * curSlow * dt / 1000;

    if (e.x <= LAWNMOWER_X) {
      if (!state.lawnUsed[e.row]) {
        triggerLawnmower(e.row);
      } else {
        state.over = true;
        state.won = false;
      }
    }
  }
}

function damageEnemy(e, dmg) {
  e.hp -= dmg;
  floatText(e.x, e.y - 30, "-" + dmg, "#6b4423");
}

function triggerLawnmower(row) {
  state.lawnUsed[row] = true;
  state.lawnAnim[row] = 1200;
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.row === row) {
      spawnExplosion(e.x, e.y, "#6b4423");
      state.enemies.splice(i, 1);
    }
  }
  showBanner("🧹 Vészseprű bevetve!");
}

/* ---------- ROBBANÁS VIZUÁL ---------- */
function spawnExplosion(x, y, color) {
  state.explosions.push({ x, y, r: 4, maxR: 46, life: 400, born: state.elapsed, color });
}
function updateExplosions(dt) {
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    const ex = state.explosions[i];
    if (state.elapsed - ex.born > ex.life) state.explosions.splice(i, 1);
  }
  for (let r = 0; r < ROWS; r++) {
    if (state.lawnAnim[r] > 0) state.lawnAnim[r] = Math.max(0, state.lawnAnim[r] - dt);
  }
}

/* ---------- GYŐZELEM / VESZTÉS ---------- */
function checkWinLose() {
  if (state.over) {
    finishLevel(false);
    return;
  }
  if (state.spawnSchedule.length === 0 && state.spawnedCount >= state.cfg.count && state.enemies.length === 0) {
    state.over = true;
    state.won = true;
    finishLevel(true);
  }
}

function finishLevel(won) {
  state.paused = true;
  if (won) {
    const stars = computeStars();
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, state.levelNum + 1));
    const key = "stars_" + state.levelNum;
    save[key] = Math.max(save[key] || 0, stars);
    saveSave(save);
    document.getElementById("win-text").textContent =
      state.levelNum >= LEVELS.length
        ? "Bubu és Dudu megmentették az egész várost! 🏆"
        : "Bubu és Dudu megvédték az otthont! " + "⭐".repeat(stars);
    document.getElementById("btn-win-next").style.display = state.levelNum >= LEVELS.length ? "none" : "block";
    showOverlay("overlay-win");
  } else {
    showOverlay("overlay-lose");
  }
}

function computeStars() {
  const lawnUsedCount = state.lawnUsed.filter(Boolean).length;
  if (lawnUsedCount === 0) return 3;
  if (lawnUsedCount <= 2) return 2;
  return 1;
}

/* =========================================================
   RENDER
   ========================================================= */
function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawBackground();
  if (!state) return;
  drawGridHighlights();
  drawCollectibles();
  drawDefenders();
  drawProjectiles();
  drawEnemies();
  drawExplosions();
  drawLawnmowers();
  drawHouse();
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, "#d7f2d2");
  grad.addColorStop(1, "#c3ecc0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  for (let r = 0; r < ROWS; r++) {
    ctx.fillStyle = r % 2 === 0 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.03)";
    ctx.fillRect(HOUSE_W, r * CELL_H, CANVAS_W - HOUSE_W, CELL_H);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(HOUSE_W + c * CELL_W, 0);
    ctx.lineTo(HOUSE_W + c * CELL_W, CANVAS_H);
    ctx.stroke();
  }
}

function drawGridHighlights() {
  if (!state.selectedUnit) return;
  ctx.fillStyle = "rgba(90,166,107,0.18)";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!state.grid[r][c]) {
        ctx.fillRect(HOUSE_W + c * CELL_W + 2, r * CELL_H + 2, CELL_W - 4, CELL_H - 4);
      }
    }
  }
}

function drawHouse() {
  ctx.fillStyle = "#c98a5e";
  ctx.fillRect(0, 0, HOUSE_W, CANVAS_H);
  ctx.font = "34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let r = 0; r < ROWS; r++) {
    ctx.fillText("🏠", HOUSE_W / 2, rowCenterY(r));
  }
}

function drawLawnmowers() {
  ctx.font = "30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let r = 0; r < ROWS; r++) {
    if (state.lawnUsed[r] && state.lawnAnim[r] <= 0) continue;
    const wobble = state.lawnAnim[r] > 0 ? Math.sin(state.lawnAnim[r] / 40) * 6 : 0;
    ctx.save();
    ctx.globalAlpha = state.lawnUsed[r] && state.lawnAnim[r] <= 0 ? 0.35 : 1;
    ctx.fillText("🧹", LAWNMOWER_X + wobble, rowCenterY(r));
    ctx.restore();
  }
}

function drawDefenders() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const d of state.defenders) {
    ctx.save();
    ctx.fillStyle = d.u.bg;
    roundRect(ctx, d.x - 30, d.y - 30, 60, 60, 14);
    ctx.fill();
    ctx.font = "30px sans-serif";
    ctx.fillText(d.u.emoji, d.x, d.y + 2);
    ctx.font = "16px sans-serif";
    ctx.fillText(d.u.badge, d.x + 20, d.y - 20);
    // HP csík
    if (d.maxHp > 1) {
      const pct = clamp(d.hp / d.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(d.x - 26, d.y + 32, 52, 6);
      ctx.fillStyle = pct > 0.4 ? "#5aa66b" : "#e63946";
      ctx.fillRect(d.x - 26, d.y + 32, 52 * pct, 6);
    }
    ctx.restore();
  }
}

function drawEnemies() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const e of state.enemies) {
    ctx.save();
    const size = e.base.boss ? 54 : 36;
    ctx.font = size + "px sans-serif";
    ctx.fillText(e.base.emoji, e.x, e.y);
    const barW = e.base.boss ? 80 : 44;
    const pct = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(e.x - barW / 2, e.y - size / 2 - 10, barW, 6);
    ctx.fillStyle = pct > 0.4 ? "#e63946" : "#8b1e2b";
    ctx.fillRect(e.x - barW / 2, e.y - size / 2 - 10, barW * pct, 6);
    if (e.slowUntil > state.elapsed) {
      ctx.font = "16px sans-serif";
      ctx.fillText("❄️", e.x - size / 2, e.y - size / 2);
    }
    ctx.restore();
  }
}

function drawProjectiles() {
  for (const p of state.projectiles) {
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawCollectibles() {
  ctx.font = "30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const c of state.collectibles) {
    const t = state.elapsed - c.born;
    const bob = Math.sin(t / 180) * 5;
    const fading = c.life - t < 1200;
    ctx.save();
    ctx.globalAlpha = fading ? clamp((c.life - t) / 1200, 0, 1) : 1;
    ctx.fillText("⭐", c.x, c.y + bob);
    ctx.restore();
  }
}

function drawExplosions() {
  for (const ex of state.explosions) {
    const t = clamp((state.elapsed - ex.born) / ex.life, 0, 1);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = ex.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, 4 + t * ex.maxR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* ---------- INDULÓ NÉZET ---------- */
showScreen("start");
