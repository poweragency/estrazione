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

/* ------------------------- Eventi ------------------------- */
// click sulla fila -> assegna al girone (animazione di uscita, niente reload)
poolEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".team-icon");
  if (!btn || btn.classList.contains("leaving")) return;
  const id = btn.dataset.id;
  const g = assign(id);            // muta lo stato subito (rotazione corretta sui click rapidi)
  if (!g) return;
  updateMeta();
  btn.classList.add("leaving");
  setTimeout(() => {
    btn.remove();
    const card = chipNode(id, groupBody[g].children.length + 1);
    groupBody[g].appendChild(card);
    updateGroupCount(g);
  }, 240);
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

/* ------------------------- Avvio ------------------------- */
state = loadState();
buildSkeleton();
