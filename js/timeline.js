// vis-timeline-Wrapper.
//   Oben das Feld „Ereignisse" (Welt-Ereignisse). Darunter werden Personen
//   platzsparend in Zeilen ("lanes") gepackt: nicht überlappende Lebensspannen
//   teilen sich eine Zeile. Innerhalb einer Zeile: Lebensbalken oben,
//   Ereignisse darunter (Untergruppen). Ereignisse einer Person können
//   ein-/ausgeklappt werden.
// Zeitliche Änderungen NUR über den Bearbeiten-Dialog (kein Drag).

import { byId, getEntryColor, readableText, rgba, persons, toDate } from './model.js?v=17';

const NO_FILTERS = { categories: [], subcategories: [] };

const EVENTS_GROUP = '__events';

export class TimelineView {
  constructor(container, cb) {
    this.container = container;
    this.cb = cb;
    this.itemsDS = new vis.DataSet();
    this.groupsDS = new vis.DataSet();

    const options = {
      stack: true,
      orientation: 'top',
      groupOrder: 'order',
      zoomMin: 1000 * 60 * 60 * 24 * 30,
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 100000,   // bis ~100.000 Jahre rauszoomen
      // Zoom macht der eigene Wheel-Handler (_bindWheel): Pinch/Cmd/Ctrl+Rad = Zoom,
      // zwei Finger horizontal = pannen, vertikal = nativ scrollen.
      zoomable: false,
      margin: { item: { horizontal: 10, vertical: 10 }, axis: 18 },
      align: 'center',              // Beschriftung mittig im Balken/Kästchen
      showCurrentTime: false,       // keine rote „Jetzt"-Linie (historische Zeitleiste)
      // Nur vertikales Ziehen von Personen zwischen Zeilen; keine Zeit-Drags.
      editable: { updateTime: false, updateGroup: true, add: false, remove: false },
      onMove: (item, callback) => this.cb.onMovePersonDrag(item, callback),
      selectable: true,
      tooltip: { followMouse: true, overflowMethod: 'flip' },
    };

    this.timeline = new vis.Timeline(container, this.itemsDS, this.groupsDS, options);
    this.zoomLimits = { min: options.zoomMin, max: options.zoomMax };
    this.timeline.on('select', (props) => this.cb.onSelect(props.items || []));
    this.timeline.on('click', (props) => this.cb.onItemClick(props));
    this.timeline.on('doubleClick', (props) => {
      if (props.item) {
        const id = realId(props.item);
        const it = this.data && byId(this.data.items, id);
        const hasChildren = it && this.data.items.some((x) => x.personId === id);
        // Doppelklick auf Container (Person / Ereignis mit Kindern) = ein-/ausklappen, sonst bearbeiten
        if (it && (it.kind === 'person' || hasChildren)) this.cb.onToggleCollapse(id);
        else this.cb.onEditItem(id);
      } else if (props.time && props.what !== 'axis') {
        this.cb.onAddAt(props.time, props.group);
      }
    });
    const redraw = () => this.cb.onChanged();
    this.timeline.on('changed', redraw);
    this.timeline.on('rangechanged', redraw);
    window.addEventListener('resize', redraw);

    this._bindWheel();
    this._bindGapDrag();
  }

  // Beim vertikalen Ziehen (Person / Welt-Ereignis) dünne „Einfüge-Zeilen"
  // (Gap-Gruppen) zwischen den bestehenden Zeilen einblenden. Ein Drop dorthin
  // legt eine NEUE Zeile an dieser Position an (Halb-Lane, z. B. 1.5 →
  // normalizeLanes in main.js macht daraus wieder ganze Zahlen).
  _bindGapDrag() {
    let pending = null;   // { area, x, y } nach mousedown auf ziehbarem Item
    this.container.addEventListener('mousedown', (e) => {
      const el = e.target.closest && e.target.closest('.vis-item');
      if (!el || !this.data) return;
      const cls = [...el.classList].find((c) => c.startsWith('id-'));
      if (!cls) return;
      const it = byId(this.data.items, cls.slice(3));
      if (!it) return;
      if (it.kind === 'person') pending = { area: 'person', x: e.clientX, y: e.clientY };
      else if (it.kind === 'event' && !it.personId) pending = { area: 'world', x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mousemove', (e) => {
      if (!pending || this._gapsArea) return;
      if (Math.abs(e.clientX - pending.x) + Math.abs(e.clientY - pending.y) < 5) return;
      this._showGaps(pending.area);
    });
    window.addEventListener('mouseup', () => {
      pending = null;
      // Nach dem Drop entfernen; bei erfolgreichem Move räumt render() ohnehin auf.
      setTimeout(() => this._hideGaps(), 0);
    });
  }

  // Gap-Gruppen-ID trägt die Ziel-Halb-Lane direkt im Namen (gap_<x> / egap_<x>),
  // x liegt strikt zwischen den (ganzzahligen) Lane-Werten der Nachbarzeilen.
  _showGaps(area) {
    if (this._gapsArea === area) return;
    this._hideGaps();
    const groups = [];
    const mk = (vals, prefix, orderBase, cls) => {
      if (!vals.length) return;
      const xs = [vals[0] - 0.5];
      for (let i = 1; i <= vals.length; i++) xs.push(vals[i - 1] + 0.5);
      for (const x of xs) groups.push({
        id: prefix + x, order: orderBase + x, className: cls, content: '', subgroupStack: false,
      });
    };
    if (area === 'person') mk(this._laneVals || [], 'gap_', 0, 'grp-gap');
    else mk(this._eLaneVals || [], 'egap_', -100000, 'grp-gap');
    if (groups.length) { this.groupsDS.add(groups); this._gapsArea = area; }
  }

  _hideGaps() {
    if (!this._gapsArea) return;
    const ids = this.groupsDS.getIds().filter((id) => /^e?gap_/.test(String(id)));
    if (ids.length) this.groupsDS.remove(ids);
    this._gapsArea = null;
  }

  // Trackpad-/Maus-Gesten: Pinch bzw. Cmd/Ctrl+Rad = Zoom um den Cursor,
  // zwei Finger links/rechts = horizontal pannen, hoch/runter = durchlassen
  // (natives Scrollen von .timeline-wrap). Safari meldet Pinch nicht als
  // ctrl+wheel, sondern über gesture*-Events (e.scale).
  _bindWheel() {
    const win = () => this.timeline.getWindow();

    // Neues Fenster setzen, Intervall auf zoomMin/zoomMax geklemmt, `anchor` =
    // Zeit (ms), die beim Zoomen unter dem Cursor fixiert bleibt (Anteil `frac`).
    const zoomTo = (interval, anchor, frac) => {
      const iv = Math.max(this.zoomLimits.min, Math.min(this.zoomLimits.max, interval));
      const start = anchor - frac * iv;
      this.timeline.setWindow(start, start + iv, { animation: false });
    };

    // Cursor-Position → Anteil im Zeitleisten-Körper (links neben dem Körper
    // liegen die Gruppen-Labels, daher .vis-center statt Container).
    const pointerFrac = (clientX) => {
      const body = this.container.querySelector('.vis-center') || this.container;
      const r = body.getBoundingClientRect();
      return r.width ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0.5;
    };

    this.container.addEventListener('wheel', (e) => {
      const w = win();
      const interval = w.end - w.start;
      if (e.ctrlKey || e.metaKey) {
        // Pinch (Browser melden sie als ctrl+wheel) oder Cmd/Ctrl+Mausrad
        e.preventDefault();
        const scale = Math.exp(Math.max(-30, Math.min(30, e.deltaY)) * 0.01);
        const frac = pointerFrac(e.clientX);
        const anchor = w.start.getTime() + frac * interval;
        zoomTo(interval * scale, anchor, frac);
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Zwei Finger links/rechts → Zeitfenster verschieben
        e.preventDefault();
        const body = this.container.querySelector('.vis-center') || this.container;
        const px = body.getBoundingClientRect().width || 1;
        const shift = e.deltaX * (interval / px);
        this.timeline.setWindow(w.start.getTime() + shift, w.end.getTime() + shift, { animation: false });
      }
      // sonst: vertikal → Event durchlassen, .timeline-wrap scrollt nativ
    }, { passive: false });

    // Safari-Pinch (proprietäre gesture*-Events; in Chrome/Firefox feuern sie nie)
    let gStart = null;
    this.container.addEventListener('gesturestart', (e) => {
      e.preventDefault();
      const w = win();
      gStart = { interval: w.end - w.start, frac: pointerFrac(e.clientX), start: w.start.getTime() };
      gStart.anchor = gStart.start + gStart.frac * gStart.interval;
    });
    this.container.addEventListener('gesturechange', (e) => {
      if (!gStart) return;
      e.preventDefault();
      zoomTo(gStart.interval / (e.scale || 1), gStart.anchor, gStart.frac);
    });
    this.container.addEventListener('gestureend', () => { gStart = null; });
  }

  render(data, visibleIds, opts = {}) {
    this.data = data;
    this.showBands = opts.showBands !== false;
    this.activeFilters = opts.activeFilters || NO_FILTERS;
    const collapsed = opts.collapsed || new Set();

    // Welt-Ereignisse (oberste Ebene) in eigene Zeilen oben
    const visWorld = data.items.filter((i) => i.kind === 'event' && !i.personId && visibleIds.has(i.id));
    const eLaneVals = [...new Set(visWorld.map((e) => e.lane || 0))].sort((a, b) => a - b);

    // Personen in eigene Zeilen unten
    const visPersons = persons(data).filter((p) => visibleIds.has(p.id));
    const laneVals = [...new Set(visPersons.map((p) => p.lane || 0))].sort((a, b) => a - b);

    // Für die Einfüge-Zeilen beim Drag merken; groupsDS.clear() unten entfernt evtl. Gaps.
    this._laneVals = laneVals;
    this._eLaneVals = eLaneVals.length ? eLaneVals : [0];
    this._gapsArea = null;

    // Container-ID → vis-Gruppe (Zeile). Personen → lane_, Welt-Ereignisse → elane_.
    const groupOf = {};
    visPersons.forEach((p) => { groupOf[p.id] = 'lane_' + (p.lane || 0); });
    visWorld.forEach((e) => { groupOf[e.id] = 'elane_' + (e.lane || 0); });
    this.groupOf = groupOf;

    const subOrder = (a, b) => (a.sgorder || 0) - (b.sgorder || 0);
    const groups = [];
    const eVals = eLaneVals.length ? eLaneVals : [0];
    eVals.forEach((v, i) => groups.push({
      id: 'elane_' + v, order: -100000 + v, className: 'grp-events' + (i === 0 ? ' grp-first' : ''),
      content: i === 0 ? 'Ereignisse' : '', subgroupStack: true, subgroupOrder: subOrder,
    }));
    laneVals.forEach((v, i) => groups.push({
      id: 'lane_' + v, order: v, className: 'grp-lane',
      content: i === 0 ? 'Personen' : '', subgroupStack: true, subgroupOrder: subOrder,
    }));
    this.groupsDS.clear();
    this.groupsDS.add(groups);

    // Unterzeilen je Container kompaktieren (row-Werte → 0..n, Lücken schließen):
    // sonst bleibt z. B. bei row=1 ohne row=0 eine leere Unterzeile zwischen
    // Container-Balken und Ereignis → Loch im Rahmen, Rahmen unnötig hoch.
    const rowMap = {};
    for (const it of data.items) {
      if (it.kind === 'event' && it.personId && visibleIds.has(it.id)) {
        (rowMap[it.personId] = rowMap[it.personId] || new Set()).add(it.row || 0);
      }
    }
    for (const k of Object.keys(rowMap)) {
      const sorted = [...rowMap[k]].sort((a, b) => a - b);
      rowMap[k] = {}; sorted.forEach((v, i) => { rowMap[k][v] = i; });
    }

    const out = [];
    for (const it of data.items) {
      if (!visibleIds.has(it.id)) continue;
      if (it.kind === 'person') out.push(this._lifeItem(it, data, it.lane || 0));
      else out.push(...this._eventItems(it, data, groupOf, collapsed, rowMap));
    }
    this.itemsDS.clear();
    this.itemsDS.add(out);
  }

  _lifeItem(p, data, lane) {
    const col = getEntryColor(p, this.activeFilters, data);
    const years = `${yr(p.start)}–${yr(p.end)}`;
    return {
      id: p.id,
      group: 'lane_' + (lane || 0),
      subgroup: 'life', sgorder: 0,
      content: `${escapeHtml(p.title)}  ·  ${years}`,
      start: toDate(p.start, 'start'),
      end: toDate(p.end || p.start, 'end'),
      type: 'range',
      className: `pkm-item pkm-life id-${p.id}`,
      style: `background:${rgba(col, 0.16)}; color:${'#33405a'}; border:1px solid ${rgba(col, 0.55)};`,
      // Hover: Titel immer zeigen (Label im Balken kann gekappt sein), plus Beschreibung
      title: [`${p.title} · ${years}`, p.description].filter(Boolean).join('\n'),
      editable: { updateTime: false, updateGroup: true, remove: false }, // Person vertikal ziehbar
    };
  }

  _eventItems(ev, data, groupOf, collapsed, rowMap) {
    const col = getEntryColor(ev, this.activeFilters, data);
    const fg = readableText(col);
    const isTop = !ev.personId;              // oberste Ebene (Welt-Ereignis / Container)
    const isRange = !!ev.end;
    const out = [];

    if (!isTop && collapsed.has(ev.personId)) return out; // Kind eines eingeklappten Containers
    const group = isTop ? groupOf[ev.id] : groupOf[ev.personId];
    if (!group) return out;                  // Container nicht sichtbar

    const evItem = {
      id: ev.id,
      group,
      content: escapeHtml(ev.title),
      start: toDate(ev.start, 'start'),
      end: ev.end ? toDate(ev.end, 'end') : undefined,
      type: isRange ? 'range' : 'box',
      // Zeitpunkt: linke Kante = Startdatum (überschreibt globales align:'center');
      // Zeitraum: undefined → globales align:'center'.
      align: isRange ? undefined : 'left',
      // Zeitraum (Start+Ende) vs. Zeitpunkt → unterschiedliche Form (CSS)
      className: `pkm-item pkm-event ${isRange ? 'pkm-ev-range' : 'pkm-ev-point'} id-${ev.id}`,
      style: `background:${col}; border-color:${rgba(col, 0)}; color:${fg};`,
      title: this._tooltip(ev, data),
      // Welt-Ereignisse (oberste Ebene) vertikal ziehbar; Kind-Ereignisse über ▲▼
      editable: isTop ? { updateTime: false, updateGroup: true, remove: false } : false,
    };
    if (isTop) { evItem.subgroup = 'life'; evItem.sgorder = 0; }        // Haupt-Balken oben
    else {
      // Kompaktierte Unterzeile (Lücken geschlossen), Reihenfolge (▲▼) bleibt erhalten
      const rm = (rowMap && rowMap[ev.personId]) || {};
      const r = rm[ev.row || 0] != null ? rm[ev.row || 0] : (ev.row || 0);
      evItem.subgroup = 'row_' + r; evItem.sgorder = 1 + r;
    }
    out.push(evItem);

    if (isTop && isRange && this.showBands) {
      out.push({ id: 'band_' + ev.id, content: '', start: toDate(ev.start, 'start'), end: toDate(ev.end, 'end'), type: 'background', className: 'pkm-band', style: `background:${rgba(col, 0.06)};`, editable: false });
    }
    return out;
  }

  _tooltip(ev, data) {
    // Titel immer dabei: gekappte Labels und Mini-Markierungen (pkm-ev-dot) zeigen
    // das Ereignis sonst nirgends im Volltext.
    const lines = [ev.title];
    if (ev.personId) { const p = byId(data.items, ev.personId); if (p) lines.push(p.title); }
    if (ev.description) lines.push(ev.description);
    const src = ev.sourceId ? byId(data.sources, ev.sourceId) : null;
    if (src) lines.push('Quelle: ' + src.title);
    return lines.join('\n') || undefined;
  }

  setSelection(ids) { this.timeline.setSelection(ids); }
  fit() { this.timeline.fit(); }

  // Layout der Kind-Zeitpunkte anwenden (vom Overlay nach Platz-Messung gesteuert):
  // `align` ('right' → Kasten wächst nach links, rechte Kante = Datum) und Größenstufe
  // als Klasse (`pkm-ev-small` = kleinere Schrift, `pkm-ev-dot` = nur Markierung + Tooltip).
  applyPointAlign(map) {
    const updates = [];
    for (const [id, st] of Object.entries(map)) {
      const cur = this.itemsDS.get(id);
      if (!cur) continue;
      const base = (cur.className || '').replace(/ ?pkm-ev-(small|dot)\b/g, '');
      const className = base +
        (st.size === 'small' ? ' pkm-ev-small' : st.size === 'dot' ? ' pkm-ev-dot' : '');
      if (cur.align === st.align && cur.className === className) continue;
      updates.push({ id, align: st.align, className });
    }
    if (updates.length) this.itemsDS.update(updates);
  }
}

function realId(id) { return String(id).startsWith('band_') ? String(id).slice(5) : id; }
function yr(s) { return s === 'now' ? 'heute' : (s ? String(s).split('-')[0] : '?'); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
