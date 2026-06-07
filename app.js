/* ============================================================
   Settimo Cup — Sorteggio gironi
   Fila di loghi cliccabili in basso. Al click la squadra
   sparisce dalla fila e finisce nel girone successivo
   seguendo l'ordine A -> B -> C -> D -> A ...
   ============================================================ */

"use strict";

/* -------- Elenco squadre (immagini nella stessa cartella) -------- */
const TEAM_FILES = [
  "CZ Equipe.jpg",
  "Dai che è bella.jpg",
  "Deportivo Aperitivo.jpg",
  "FC Banane.jpg",
  "FC Etta Nera.jpg",
  "FC Fuego.jpg",
  "FC retrocessi.jpg",
  "I legionari.jpg",
  "I senza nome.jpg",
  "J.B.jpg",
  "MCM.jpg",
  "MN7.jpg",
  "New Team.jpg",
  "Nord Ovest.jpg",
  "Ravioli.jpg",
  "Real Tessera.jpg",
  "TIF8A90.jpg",
  "Team TE.jpg",
  "Washing Machine United.jpg",
  "watches.jpg",
];

const GROUPS = ["A", "B", "C", "D"];
const STORAGE_KEY = "settimo-cup-gironi-v1";

/* ---------------------- Modello squadre ---------------------- */
function stripExt(f) { return f.replace(/\.(jpe?g|png|webp|gif|avif)$/i, ""); }
function initials(name) {
  const w = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
}

const TEAMS = TEAM_FILES.map((file, i) => ({
  id: "t" + i,
  name: stripExt(file),
  src: encodeURI(file),          // gestisce spazi e accenti nei nomi file
  initials: initials(stripExt(file)),
}));
const TEAM_BY_ID = Object.fromEntries(TEAMS.map(t => [t.id, t]));
const ORDER_INDEX = Object.fromEntries(TEAMS.map((t, i) => [t.id, i]));

/* ------------------------- Stato ------------------------- */
let state = null;     // { pool:[ids], groups:{A:[],B:[],C:[],D:[]}, history:[ids] }

function freshState() {
  return {
    pool: TEAMS.map(t => t.id),
    groups: { A: [], B: [], C: [], D: [] },
    history: [],
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && s.pool && s.groups && GROUPS.every(g => Array.isArray(s.groups[g]))) {
      // verifica che gli id corrispondano alle squadre attuali
      const all = [...s.pool, ...GROUPS.flatMap(g => s.groups[g])];
      const ids = new Set(TEAMS.map(t => t.id));
      if (all.length === TEAMS.length && all.every(id => ids.has(id)) && new Set(all).size === all.length) {
        if (!Array.isArray(s.history)) s.history = [];
        return s;
      }
    }
  } catch (_) {}
  return freshState();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

/* Girone con meno squadre (a parità vince A<B<C<D) -> ordine A,B,C,D,A,... */
function nextGroup() {
  let best = GROUPS[0], min = Infinity;
  for (const g of GROUPS) {
    if (state.groups[g].length < min) { min = state.groups[g].length; best = g; }
  }
  return best;
}

/* ------------------------- Azioni (solo stato) -------------------------
   Ognuna ritorna il girone interessato così l'interfaccia aggiorna
   SOLO gli elementi cambiati, senza ridisegnare tutta la pagina.        */
function assign(teamId) {
  const i = state.pool.indexOf(teamId);
  if (i === -1) return null;
  const g = nextGroup();
  state.pool.splice(i, 1);
  state.groups[g].push(teamId);
  state.history.push(teamId);
  saveState();
  return g;
}

function removeFromGroup(teamId) {
  for (const g of GROUPS) {
    const i = state.groups[g].indexOf(teamId);
    if (i !== -1) {
      state.groups[g].splice(i, 1);
      state.pool.push(teamId);
      state.pool.sort((a, b) => ORDER_INDEX[a] - ORDER_INDEX[b]);
      const h = state.history.lastIndexOf(teamId);
      if (h !== -1) state.history.splice(h, 1);
      saveState();
      return g;
    }
  }
  return null;
}

function undo() {
  const last = state.history.pop();
  if (!last) return null;
  let group = null;
  for (const g of GROUPS) {
    const i = state.groups[g].indexOf(last);
    if (i !== -1) { state.groups[g].splice(i, 1); group = g; break; }
  }
  state.pool.push(last);
  state.pool.sort((a, b) => ORDER_INDEX[a] - ORDER_INDEX[b]);
  saveState();
  return { id: last, group };
}

/* ------------------------- Rendering ------------------------- */
const groupsEl = document.getElementById("groups");
const poolEl = document.getElementById("pool");
const countEl = document.getElementById("assigned-count");
const hintEl = document.getElementById("next-hint");

// riferimenti agli elementi fissi dei gironi (creati una volta sola)
const groupBody = {};   // g -> <div class="group-body">
const groupCount = {};  // g -> <span class="group-count">

function logoHTML(team) {
  return (
    `<span class="logo">` +
      `<span class="initials">${team.initials}</span>` +
      `<img src="${team.src}" alt="${team.name}" draggable="false" onerror="this.remove()">` +
    `</span>`
  );
}

// crea un nodo DOM a partire da una stringa HTML (un solo elemento radice)
function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function poolIconNode(id) {
  const t = TEAM_BY_ID[id];
  return el(
    `<button class="team-icon" data-id="${id}" title="${t.name}">` +
      logoHTML(t) +
      `<span class="team-name">${t.name}</span>` +
    `</button>`
  );
}

function chipNode(id, seed) {
  const t = TEAM_BY_ID[id];
  return el(
    `<div class="chip" data-id="${id}" title="Clicca per rimuovere ${t.name}">` +
      `<span class="seed">${seed}</span>` +
      logoHTML(t) +
      `<span class="chip-name">${t.name}</span>` +
      `<span class="chip-x">×</span>` +
    `</div>`
  );
}

// aggiorna SOLO contatori e suggerimento (testo, nessun reload)
function updateMeta() {
  const assigned = TEAMS.length - state.pool.length;
  countEl.textContent = `${assigned} / ${TEAMS.length} assegnate`;
  hintEl.textContent = state.pool.length ? `Prossima → Girone ${nextGroup()}` : "Sorteggio completato 🎉";
}

function updateGroupCount(g) {
  groupCount[g].textContent = state.groups[g].length;
}

// rinumera le card di un solo girone (dopo una rimozione)
function renumberGroup(g) {
  const seeds = groupBody[g].querySelectorAll(".chip .seed");
  seeds.forEach((s, i) => { s.textContent = i + 1; });
}

// inserisce un'icona nella fila rispettando l'ordine originale
function insertPoolIcon(id) {
  const idx = state.pool.indexOf(id);
  const ref = poolEl.children[idx] || null;
  poolEl.insertBefore(poolIconNode(id), ref);
}

// costruzione iniziale (una sola volta) dello scheletro
function buildSkeleton() {
  groupsEl.innerHTML = "";
  GROUPS.forEach((g, gi) => {
    const colorVar = ["--gA", "--gB", "--gC", "--gD"][gi];
    const section = el(
      `<section class="group" style="--g: var(${colorVar});">` +
        `<div class="group-head">` +
          `<span class="group-badge">${g}</span>` +
          `<span class="group-title">Girone ${g}</span>` +
          `<span class="group-count">0</span>` +
        `</div>` +
        `<div class="group-body"></div>` +
      `</section>`
    );
    groupBody[g] = section.querySelector(".group-body");
    groupCount[g] = section.querySelector(".group-count");
    groupsEl.appendChild(section);
  });

  // ripopola gironi e fila dallo stato corrente
  GROUPS.forEach(g => {
    state.groups[g].forEach((id, i) => groupBody[g].appendChild(chipNode(id, i + 1)));
    updateGroupCount(g);
  });
  poolEl.innerHTML = "";
  state.pool.forEach(id => poolEl.appendChild(poolIconNode(id)));
  updateMeta();
}

/* ------------------- Animazione di volo del logo ------------------- */
const prefersReduced = window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// overlay scuro riutilizzabile
const overlay = document.createElement("div");
overlay.className = "flash-overlay";
document.body.appendChild(overlay);

// "stage" con gli effetti speciali (raggi, alone, scintille, nome)
const stage = document.createElement("div");
stage.className = "stage";
const SPARKS = [
  { r: 210, s: 8, d: 9,  delay: 0,    td: 0,   c: "#e6c976", rev: false },
  { r: 250, s: 6, d: 12, delay: -3,   td: 0.3, c: "#ffce5a", rev: true  },
  { r: 190, s: 5, d: 7,  delay: -1.5, td: 0.6, c: "#c9a24a", rev: false },
  { r: 280, s: 7, d: 14, delay: -6,   td: 0.2, c: "#f7e6b6", rev: true  },
  { r: 230, s: 5, d: 10, delay: -4,   td: 0.9, c: "#fff6e0", rev: false },
  { r: 300, s: 6, d: 16, delay: -8,   td: 0.5, c: "#d9b24a", rev: true  },
  { r: 170, s: 4, d: 8,  delay: -2,   td: 0.1, c: "#f0d585", rev: false },
];
const orbitsHTML = SPARKS.map(p =>
  `<span class="orbit${p.rev ? " rev" : ""}" style="--d:${p.d}s;--delay:${p.delay}s;">` +
    `<i class="spark" style="--r:${p.r}px;--s:${p.s}px;--c:${p.c};--td:${p.td}s;"></i>` +
  `</span>`
).join("");
stage.innerHTML =
  `<div class="rays"></div>` +
  `<div class="rays rev"></div>` +
  `<div class="halo"></div>` +
  `<div class="sparks">${orbitsHTML}</div>` +
  `<div class="nameplate"><span class="np-kicker">Settimo Cup</span><span class="np-name"></span></div>`;
document.body.appendChild(stage);
const nameEl = stage.querySelector(".np-name");

// "riflettore": overlay scuro + stage, con conteggio per i voli sovrapposti
let spot = 0;
function spotOn(name) {
  spot++;
  if (name) nameEl.textContent = name;
  overlay.classList.add("on");
  stage.classList.add("on");
}
function spotOff() {
  spot = Math.max(0, spot - 1);
  if (!spot) { overlay.classList.remove("on"); stage.classList.remove("on"); }
}

function placeChip(id, g) {
  const card = chipNode(id, groupBody[g].children.length + 1);
  groupBody[g].appendChild(card);
  updateGroupCount(g);
  return card;
}

// fasi del volo (ms): andata, sosta al centro, ritorno
const FLY_IN = 700;
const HOLD = 7000;          // sosta cinematografica al centro
const FLY_OUT = 900;
const FLIGHT = FLY_IN + HOLD + FLY_OUT;
const oin = FLY_IN / FLIGHT;            // offset di arrivo al centro
const oout = (FLY_IN + HOLD) / FLIGHT;  // offset di partenza dal centro
const oAt = ms => (FLY_IN + ms) / FLIGHT;   // offset a "ms" dall'arrivo al centro

// trasformazione del flyer: prospettiva + traslazione + scala + tilt 3D
function tf(tx, ty, scale, rx, ry, rz) {
  return `perspective(1000px) translate(${tx}px, ${ty}px) scale(${scale}) ` +
         `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
}

// vola: icona -> centro schermo (sosta di 7s con effetti) -> posto nel girone
function flyToGroup(btn, id, g) {
  const logoEl = btn.querySelector(".logo");
  const startRect = logoEl.getBoundingClientRect();
  const inner = logoEl.innerHTML;

  btn.remove();                              // l'icona lascia subito la fila

  // card di arrivo, nascosta, solo per misurare il punto d'atterraggio
  const seed = groupBody[g].children.length + 1;
  const card = chipNode(id, seed);
  card.style.visibility = "hidden";
  groupBody[g].appendChild(card);
  const endRect = card.querySelector(".logo").getBoundingClientRect();

  const flyer = document.createElement("div");
  flyer.className = "flyer lit";
  flyer.style.left = startRect.left + "px";
  flyer.style.top = startRect.top + "px";
  flyer.style.width = startRect.width + "px";
  flyer.style.height = startRect.height + "px";
  flyer.innerHTML = inner;
  document.body.appendChild(flyer);
  spotOn(TEAM_BY_ID[id].name);

  // spostamenti del centro del logo (transform-origin: center)
  const scx = startRect.left + startRect.width / 2;
  const scy = startRect.top + startRect.height / 2;
  const cx = window.innerWidth / 2 - scx;          // verso il centro schermo
  const cy = window.innerHeight / 2 - scy;
  const ex = (endRect.left + endRect.width / 2) - scx;  // verso il girone
  const ey = (endRect.top + endRect.height / 2) - scy;
  const endScale = endRect.width / startRect.width;
  const big = Math.max(2.0, Math.min(2.8, 175 / startRect.width));

  const sine = "cubic-bezier(.37,0,.63,1)";   // movimento morbido "fluttuante"

  const anim = flyer.animate([
    { transform: tf(0, 0, 1, 0, 0, 0), offset: 0 },
    // arrivo al centro con leggero overshoot elegante
    { transform: tf(cx, cy, big, 0, 0, 0), offset: oin, easing: "cubic-bezier(.16,.78,.22,1.06)" },
    // --- sosta cinematografica (7s): tilt 3D multiasse, dondolio, respiro ---
    { transform: tf(cx,     cy - 14, big * 1.05,  6,  16,  2),   offset: oAt(750),  easing: sine },
    { transform: tf(cx + 8, cy + 10, big * 0.99, -5, -14, -2),   offset: oAt(1650), easing: sine },
    { transform: tf(cx - 6, cy - 12, big * 1.06,  7,  12,  1.5), offset: oAt(2550), easing: sine },
    { transform: tf(cx + 6, cy + 8,  big * 1.00, -6, -16, -2),   offset: oAt(3450), easing: sine },
    { transform: tf(cx - 2, cy - 10, big * 1.05,  5,  14,  2),   offset: oAt(4350), easing: sine },
    { transform: tf(cx - 4, cy + 10, big * 1.00, -7, -12, -1.5), offset: oAt(5250), easing: sine },
    { transform: tf(cx + 2, cy - 6,  big * 1.03,  4,  8,   1),   offset: oAt(6150), easing: sine },
    // si ricompone perfettamente dritto prima di ripartire
    { transform: tf(cx, cy, big, 0, 0, 0), offset: oout, easing: "cubic-bezier(.5,0,.5,1)" },
    // discesa elegante nel girone
    { transform: tf(ex, ey, endScale, 0, 0, 0), offset: 1, easing: "cubic-bezier(.5,0,.22,1)" },
  ], { duration: FLIGHT, fill: "forwards" });

  // spegne riflettore ed effetti quando il logo lascia il centro
  setTimeout(() => { flyer.classList.remove("lit"); spotOff(); }, FLY_IN + HOLD);

  const finish = () => {
    card.style.visibility = "";
    card.classList.add("land");
    updateGroupCount(g);
    flyer.remove();
  };
  anim.onfinish = finish;
  anim.oncancel = finish;
}

/* ------------------------- Eventi ------------------------- */
// click sulla fila -> assegna al girone (con animazione di volo, niente reload)
poolEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".team-icon");
  if (!btn) return;
  const id = btn.dataset.id;
  const g = assign(id);            // muta lo stato subito (rotazione corretta sui click rapidi)
  if (!g) return;
  updateMeta();
  if (prefersReduced) {
    btn.remove();
    placeChip(id, g).classList.add("land");
    return;
  }
  flyToGroup(btn, id, g);
});

// click su una squadra dentro un girone -> torna nella fila
groupsEl.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  const id = chip.dataset.id;
  const g = removeFromGroup(id);
  if (!g) return;
  chip.remove();
  renumberGroup(g);
  updateGroupCount(g);
  insertPoolIcon(id);
  updateMeta();
});

document.getElementById("btn-undo").addEventListener("click", () => {
  const r = undo();
  if (!r) return;
  const chip = groupBody[r.group] && groupBody[r.group].querySelector(`.chip[data-id="${r.id}"]`);
  if (chip) { chip.remove(); renumberGroup(r.group); updateGroupCount(r.group); }
  insertPoolIcon(r.id);
  updateMeta();
});

document.getElementById("btn-reset").addEventListener("click", () => {
  if (!confirm("Riportare tutte le squadre nella fila in basso?")) return;
  state = freshState();
  saveState();
  buildSkeleton();
});

/* ------------------- Anteprima (intro) ------------------- */
const introEl = document.getElementById("intro");
const startBtn = document.getElementById("btn-start");
if (startBtn) {
  startBtn.addEventListener("click", () => introEl.classList.add("hidden"));
}

// marquee loghi partner: lista duplicata per lo scorrimento senza salti
const SPONSOR_COUNT = 15;
const sponsorTrack = document.getElementById("sponsor-track");
if (sponsorTrack) {
  const cards = [];
  for (let i = 1; i <= SPONSOR_COUNT; i++) {
    cards.push(`<div class="sponsor"><img src="sponsor${i}.png" alt="Partner ${i}" loading="lazy" draggable="false"></div>`);
  }
  sponsorTrack.innerHTML = cards.join("") + cards.join("");
}

/* ------------------------- Avvio ------------------------- */
state = loadState();
buildSkeleton();
