// Bootstrap & Steuerung: hält den App-Zustand, verdrahtet Toolbar, Timeline,
// Overlay (Verbindungen), Filter und Modals; speichert nach jeder Änderung.

import { LocalStorageStore, exportJson, importJson } from './store.js?v=17';
import * as model from './model.js?v=17';
import { TimelineView } from './timeline.js?v=17';
import { OverlayLayer } from './connections.js?v=17';
import { FilterBar } from './filters.js?v=17';
import * as ui from './ui.js?v=17';

const store = new LocalStorageStore();

let data = null;
let selectedItemId = null;
let showShading = true;
let showConnections = true;
const collapsed = new Set();   // Person-IDs mit eingeklappten Ereignissen
const linkMode = { active: false, fromId: null };
let timelineView, overlay, filterBar, detailPanel;

init();

async function init() {
  const loaded = await store.load();
  data = normalize(loaded || model.seedData());
  const repaired = enforceLaneIntegrity();
  detailPanel = document.getElementById('detail-panel');

  timelineView = new TimelineView(document.getElementById('timeline'), {
    onSelect: handleSelect,
    onItemClick: handleItemClick,
    onEditItem: editItem,
    onAddAt: addItemAt,
    onChanged: () => overlay.draw(),
    onToggleCollapse: toggleCollapsePerson,   // Doppelklick auf Person
    onMovePersonDrag: handlePersonDrag,       // Person per Maus in andere Zeile ziehen
  });
  overlay = new OverlayLayer(document.querySelector('.timeline-wrap'), document.getElementById('timeline'), {
    onConnClick: editConnection,
    onPointAlign: (map) => timelineView.applyPointAlign(map),
  });
  filterBar = new FilterBar(document.getElementById('filter-bar'), { onChange: render });

  wireToolbar();
  filterBar.setData(data);
  render();
  timelineView.fit();
  if (!loaded || repaired) persist();
}

// ---------- Rendern & Speichern ----------
function render() {
  const visible = filterBar.visibleIds();
  const activeFilters = filterBar.activeFilters();
  timelineView.render(data, visible, { showBands: showShading, collapsed, activeFilters });
  overlay.setData(data, visible, { showConnections, activeFilters });
  timelineView.setSelection(selectedItemId ? [selectedItemId] : []);
  renderDetail();
  applyLinkHighlight();
}
function renderDetail() {
  ui.renderDetail(detailPanel, selectedItemId ? model.byId(data.items, selectedItemId) : null, data, {
    onEdit: editItem, onSelectItem: selectItem, onLinkFrom: startLinkFrom,
    onToggleCollapse: toggleCollapsePerson, isCollapsed: (id) => collapsed.has(id),
    onMovePerson: movePerson, onMoveEvent: moveEvent,
  });
}
async function persist() { data.meta.updated = new Date().toISOString(); await store.save(data); }
function refreshAll() { filterBar.setData(data); render(); persist(); }

// ---------- Auswahl / Detail ----------
function handleSelect(ids) {
  if (linkMode.active) return;
  selectedItemId = ids[0] ? realId(ids[0]) : null;
  renderDetail();
}
function selectItem(id) { selectedItemId = id; timelineView.setSelection([id]); renderDetail(); }

function handleItemClick(props) {
  if (!linkMode.active || !props.item) return;
  const clicked = realId(props.item);
  if (!linkMode.fromId) {
    linkMode.fromId = clicked;
    setHint(`Verknüpfen: Ziel anklicken (Quelle: „${titleOf(clicked)}"). ESC bricht ab.`);
    applyLinkHighlight();
    return;
  }
  if (clicked === linkMode.fromId) return;
  const fromId = linkMode.fromId;
  exitLinkMode();
  ui.openConnectionModal(data, null, { fromId, toId: clicked }, { onSave: upsertConnection, onDelete: deleteConnection });
}

// ---------- Items ----------
function addItemAt(time, group) {
  const personId = group && group !== '__events' && model.byId(data.items, group)?.kind === 'person' ? group : null;
  ui.openItemModal(data, { kind: 'event', start: toISODate(time), personId }, { onSave: upsertItem, onDelete: deleteItem });
}
function editItem(id) { ui.openItemModal(data, model.byId(data.items, realId(id)), { onSave: upsertItem, onDelete: deleteItem }); }

function upsertItem(values) {
  const existing = values.id ? model.byId(data.items, values.id) : null;
  if (existing) {
    Object.assign(existing, values);
  } else {
    const item = model.makeItem(values);
    if (item.kind === 'person' || (item.kind === 'event' && !item.personId)) item.lane = fitLane(item);
    data.items.push(item);
    selectedItemId = item.id;
  }
  refreshAll();
}
function deleteItem(id) {
  const it = model.byId(data.items, id);
  data.items = data.items.filter((i) => i.id !== id);
  data.connections = data.connections.filter((c) => c.fromId !== id && c.toId !== id);
  if (it && it.kind === 'person') data.items.forEach((e) => { if (e.personId === id) e.personId = null; });
  if (selectedItemId === id) selectedItemId = null;
  refreshAll();
}

// ---------- Zeilen (Personen & Welt-Ereignisse) / Einklappen ----------
// Personen und Welt-Ereignisse teilen sich das gleiche Zeilen-System („lane"),
// aber in getrennten Bereichen (Personen unten, Welt-Ereignisse oben).
function laneSiblings(item) {
  return item.kind === 'person' ? model.persons(data) : model.worldEvents(data);
}

// Zeitliche Überschneidung zweier Einträge (Zeilen-Integrität: Überlapper teilen sich nie eine Zeile).
function overlaps(a, b) {
  return +model.toDate(a.start, 'start') <= +model.toDate(b.end || b.start, 'end')
    && +model.toDate(b.start, 'start') <= +model.toDate(a.end || a.start, 'end');
}
// Würde `item` in Zeile `lane` einen Geschwister-Eintrag zeitlich überschneiden?
function laneClash(item, lane) {
  return laneSiblings(item).some((s) => s.id !== item.id && (s.lane || 0) === lane && overlaps(s, item));
}

// Freie Zeile für einen neuen Eintrag finden (keine zeitliche Überschneidung), sonst neue.
function fitLane(item) {
  const list = laneSiblings(item);
  const lanes = [...new Set(list.map((p) => p.lane || 0))].sort((a, b) => a - b);
  for (const lane of lanes) {
    if (!list.filter((p) => (p.lane || 0) === lane).some((p) => overlaps(p, item))) return lane;
  }
  return (lanes.length ? lanes[lanes.length - 1] + 1 : 0);
}

// Zeilen-Integrität herstellen (beim Laden/Import): zeitlich überlappende Einträge
// dürfen sich keine Zeile teilen — Überlapper wandern in eigene Zwischenzeilen.
function enforceLaneIntegrity() {
  let changed = false;
  for (const list of [model.persons(data), model.worldEvents(data)]) {
    const lanes = [...new Set(list.map((p) => p.lane || 0))].sort((a, b) => a - b);
    for (const lane of lanes) {
      const inLane = list.filter((p) => (p.lane || 0) === lane)
        .sort((a, b) => +model.toDate(a.start, 'start') - +model.toDate(b.start, 'start'));
      const kept = [], moved = [];
      for (const p of inLane) (kept.some((k) => overlaps(k, p)) ? moved : kept).push(p);
      moved.forEach((p, i) => { p.lane = lane + (i + 1) / (moved.length + 1); });
      if (moved.length) changed = true;
    }
    const before = list.map((p) => p.lane);
    normalizeLanes(list);
    if (!changed) changed = list.some((p, i) => p.lane !== before[i]);
  }
  return changed;
}

// Zeilen-Werte einer Liste auf 0..N normalisieren.
function normalizeLanes(list) {
  const vals = [...new Set(list.map((p) => p.lane || 0))].sort((a, b) => a - b);
  const remap = {}; vals.forEach((v, i) => { remap[v] = i; });
  list.forEach((p) => { p.lane = remap[p.lane || 0]; });
}

// ▲▼ aus dem Detailpanel: Person ODER Welt-Ereignis vertikal verschieben.
// Überschneidet sich der Eintrag zeitlich mit der Zielzeile, wird stattdessen eine
// neue Zeile dazwischen eingefügt (Halb-Lane) — Überlapper teilen sich nie eine Zeile.
function movePerson(id, dir) {  // dir -1 = höher, +1 = tiefer
  const it = model.byId(data.items, id);
  if (!it) return;
  const list = laneSiblings(it);
  const vals = [...new Set(list.map((x) => x.lane || 0))].sort((a, b) => a - b);
  const idx = vals.indexOf(it.lane || 0);
  const target = dir < 0
    ? (idx > 0 ? vals[idx - 1] : (it.lane || 0) - 1)
    : (idx < vals.length - 1 ? vals[idx + 1] : (it.lane || 0) + 1);
  it.lane = laneClash(it, target) ? target - dir * 0.5 : target;
  normalizeLanes(list);
  render(); persist();
}

function moveEvent(id, dir) {  // Unterzeile innerhalb der Person
  const e = model.byId(data.items, id);
  if (!e) return;
  e.row = Math.max(0, (e.row || 0) + dir);
  render(); persist();
}

// Per Maus vertikal in eine andere Zeile ziehen (vis onMove): Person (lane_) oder Welt-Ereignis (elane_).
// Drop auf eine Einfüge-Zeile (gap_/egap_, Halb-Lane z. B. 1.5) = NEUE Zeile zwischen zwei
// bestehenden; normalizeLanes macht daraus wieder ganze Zahlen.
function handlePersonDrag(visItem, callback) {
  const it = model.byId(data.items, visItem.id);
  if (!it) { callback(null); return; }
  const g = visItem.group || '';
  const mP = /^lane_(-?\d+)$/.exec(g), mE = /^elane_(-?\d+)$/.exec(g);
  const gP = /^gap_(-?\d+(?:\.\d+)?)$/.exec(g), gE = /^egap_(-?\d+(?:\.\d+)?)$/.exec(g);
  // Drop in bestehende Zeile mit zeitlicher Überschneidung → stattdessen neue
  // Zeile direkt darüber einfügen (Integrität: Überlapper teilen sich nie eine Zeile).
  const intoLane = (v) => { it.lane = laneClash(it, v) ? v - 0.5 : v; };
  if (it.kind === 'person' && mP) intoLane(parseInt(mP[1], 10));
  else if (it.kind === 'person' && gP) it.lane = parseFloat(gP[1]);
  else if (it.kind === 'event' && !it.personId && mE) intoLane(parseInt(mE[1], 10));
  else if (it.kind === 'event' && !it.personId && gE) it.lane = parseFloat(gE[1]);
  else { callback(null); return; }   // nicht über Bereichsgrenze ziehen
  callback(null);
  normalizeLanes(laneSiblings(it));
  persist();
  render();
}

function toggleCollapsePerson(id) {
  collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
  render();
}
function toggleCollapseAll(btn) {
  // alle Container mit Kindern: Personen + Welt-Ereignisse mit Sub-Ereignissen
  const containers = [...model.persons(data), ...model.worldEvents(data)]
    .filter((c) => model.eventsOf(data, c.id).length > 0);
  const allCollapsed = containers.length > 0 && containers.every((c) => collapsed.has(c.id));
  if (allCollapsed) collapsed.clear();
  else containers.forEach((c) => collapsed.add(c.id));
  if (btn) btn.classList.toggle('active', !allCollapsed);
  render();
}

// ---------- Verbindungen ----------
function startLinkFrom(id) { enterLinkMode(); linkMode.fromId = id; setHint(`Verknüpfen: Ziel anklicken (Quelle: „${titleOf(id)}"). ESC bricht ab.`); applyLinkHighlight(); }
function editConnection(id) { ui.openConnectionModal(data, model.byId(data.connections, id), null, { onSave: upsertConnection, onDelete: deleteConnection }); }
function upsertConnection(values) {
  const existing = values.id ? model.byId(data.connections, values.id) : null;
  if (existing) Object.assign(existing, values); else data.connections.push(model.makeConnection(values));
  render(); persist();
}
function deleteConnection(id) { data.connections = data.connections.filter((c) => c.id !== id); render(); persist(); }

// ---------- Linkmodus ----------
function toggleLinkMode() { linkMode.active ? exitLinkMode() : enterLinkMode(); }
function enterLinkMode() {
  linkMode.active = true; linkMode.fromId = null;
  document.body.classList.add('link-mode');
  document.getElementById('btn-link-mode').classList.add('active');
  setHint('Verknüpfen: Quelle anklicken. ESC bricht ab.');
  document.addEventListener('keydown', escLink);
}
function exitLinkMode() {
  linkMode.active = false; linkMode.fromId = null;
  document.body.classList.remove('link-mode');
  document.getElementById('btn-link-mode').classList.remove('active');
  hideHint(); document.removeEventListener('keydown', escLink); applyLinkHighlight();
}
function escLink(e) { if (e.key === 'Escape') exitLinkMode(); }
function applyLinkHighlight() {
  document.querySelectorAll('.pkm-link-source').forEach((n) => n.classList.remove('pkm-link-source'));
  if (linkMode.active && linkMode.fromId) {
    const elx = document.querySelector('#timeline .vis-item.id-' + cssEscape(linkMode.fromId));
    if (elx) elx.classList.add('pkm-link-source');
  }
}

// ---------- Toolbar ----------
function wireToolbar() {
  document.getElementById('btn-add-item').addEventListener('click', () => ui.openItemModal(data, null, { onSave: upsertItem, onDelete: deleteItem }));
  document.getElementById('btn-link-mode').addEventListener('click', toggleLinkMode);
  document.getElementById('btn-shading').addEventListener('click', (e) => {
    showShading = !showShading;
    e.currentTarget.classList.toggle('active', showShading);
    render();
  });
  document.getElementById('btn-connections').addEventListener('click', (e) => {
    showConnections = !showConnections;
    e.currentTarget.classList.toggle('active', showConnections);
    render();
  });
  document.getElementById('btn-collapse').addEventListener('click', (e) => toggleCollapseAll(e.currentTarget));
  document.getElementById('btn-categories').addEventListener('click', () => ui.openCategoryManager(data, { onChange: refreshAll }));
  document.getElementById('btn-sources').addEventListener('click', () => ui.openSourceManager(data, { onChange: refreshAll }));
  document.getElementById('btn-fit').addEventListener('click', () => timelineView.fit());
  document.getElementById('btn-export').addEventListener('click', () => exportJson(data));
  const fileInput = document.getElementById('import-file');
  document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0]; if (!file) return;
    try { data = normalize(await importJson(file)); enforceLaneIntegrity(); selectedItemId = null; refreshAll(); timelineView.fit(); }
    catch (err) { alert('Datei konnte nicht gelesen werden: ' + err.message); }
    fileInput.value = '';
  });
}

// ---------- Hint ----------
function setHint(text) { const b = document.getElementById('hint-bar'); b.textContent = text; b.hidden = false; }
function hideHint() { const b = document.getElementById('hint-bar'); b.hidden = true; b.textContent = ''; }

// ---------- Helfer ----------
function realId(id) { const s = String(id); return s.startsWith('band_') ? s.slice(5) : s; }
function titleOf(id) { const it = model.byId(data.items, id); return it ? it.title : '?'; }
function toISODate(d) { const x = new Date(d); if (isNaN(x)) return null; const p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; }
function cssEscape(s) { return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }

function normalize(d) {
  const base = model.emptyData();
  return {
    items: Array.isArray(d.items) ? d.items.map((i) => model.makeItem(i)) : [],
    categories: Array.isArray(d.categories) ? d.categories.map((c) => model.makeCategory(c)) : [],
    subcategories: Array.isArray(d.subcategories) ? d.subcategories.map((s) => model.makeSubcategory(s)) : [],
    connections: Array.isArray(d.connections) ? d.connections.map((c) => model.makeConnection(c)) : [],
    sources: Array.isArray(d.sources) ? d.sources.map((s) => model.makeSource(s)) : [],
    meta: d.meta || base.meta,
  };
}
