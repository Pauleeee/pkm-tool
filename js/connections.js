// SVG-Overlay über der Timeline:
//   1. ein Kasten je Person (Lebensbalken + ihre Ereignisse), bündig um den
//      Inhalt (kein Überstand links/rechts, vertikal zentriert).
//   2. Verbindungspfeile direkt von Ereignis zu Ereignis (abschaltbar).
//   3. kleiner Pfeil-Marker auf dem Datum jedes Zeitpunkt-Ereignisses; misst
//      zudem je Kind-Zeitpunkt den Platz im Rahmen (= Container-Balken) und
//      wählt eine Layout-Stufe: normal → kleinere Schrift → nur Markierung
//      (Tooltip zeigt das Ereignis), jeweils links- oder rechtsbündig am Datum.

import { persons, worldEvents, eventsOf, getEntryColor, rgba } from './model.js?v=20';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Muss zu den CSS-Regeln in styles.css passen (.pkm-ev-point / .pkm-ev-small):
// font = Schriftgröße, padX = horizontales Padding gesamt, maxW = max-width des Kastens.
const MEASURE = {
  normal: { font: 11, padX: 18, maxW: 150 },
  small:  { font: 10, padX: 14, maxW: 130 },
};
const DOT_W = 8;   // Breite der Mini-Markierung (.pkm-ev-dot) inkl. Toleranz

export class OverlayLayer {
  constructor(wrapEl, timelineContainer, cb) {
    this.tlContainer = timelineContainer;
    this.cb = cb; // { onConnClick(id), onPointAlign(map) }
    this.data = null;
    this.visibleIds = new Set();
    this.showConnections = true;
    this.activeFilters = { categories: [], subcategories: [] };
    this.pointAlignState = {}; // id → { align:'left'|'right', size:'normal'|'small'|'dot' }

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('conn-overlay');
    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML =
      '<marker id="arrow" viewBox="0 0 10 10" refX="8.5" refY="5" ' +
      'markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="var(--conn)"></path></marker>';
    svg.appendChild(defs);
    this.svg = svg;
    wrapEl.appendChild(svg);
  }

  setData(data, visibleIds, opts = {}) {
    this.data = data;
    this.visibleIds = visibleIds;
    if (opts.showConnections !== undefined) this.showConnections = opts.showConnections;
    if (opts.activeFilters) this.activeFilters = opts.activeFilters;
    this.pointAlignState = {};   // voller Render → Ausrichtung frisch neu bestimmen
    this.draw();
  }

  draw() {
    if (!this.data) return;
    [...this.svg.querySelectorAll('g.ov')].forEach((n) => n.remove());
    this.svg.style.width = this.tlContainer.offsetWidth + 'px';
    this.svg.style.height = this.tlContainer.offsetHeight + 'px';
    const overlay = this.svg.getBoundingClientRect();

    this._drawFrames(overlay);
    this._drawArrows(overlay);
    if (this.showConnections) this._drawConnections(overlay);

    // Kind-Zeitpunkte an den Rahmen (= Container-Balken) anpassen: Ausrichtung + Größenstufe.
    // Das Item-Update MUSS außerhalb des vis-Redraw-Zyklus passieren (sonst „infinite loop
    // in redraw") und erst NACH dem Settle (nicht mitten in der fit-Animation) → entprellt.
    // Die Entscheidung ist zustands-unabhängig (nur Datum/Naturbreite/Container) → terminiert.
    this._scheduleAlign();
  }

  _scheduleAlign() {
    if (!this.cb.onPointAlign) return;
    clearTimeout(this._alignTimer);
    this._alignTimer = setTimeout(() => {
      const desired = this._computePointLayout(this.svg.getBoundingClientRect());
      if (!this._alignChanged(desired)) return;
      this.pointAlignState = desired;
      this.cb.onPointAlign(desired);   // → itemsDS.update → vis 'changed' → draw()
    }, 120);
  }

  _alignChanged(next) {
    const cur = this.pointAlignState;
    const keys = new Set([...Object.keys(cur), ...Object.keys(next)]);
    for (const k of keys) {
      const a = cur[k] || {}, b = next[k] || {};
      if ((a.align || 'left') !== (b.align || 'left')) return true;
      if ((a.size || 'normal') !== (b.size || 'normal')) return true;
    }
    return false;
  }

  // Für jedes sichtbare Kind-Zeitpunkt-Ereignis Ausrichtung + Größenstufe bestimmen.
  // Regel: das Ereignis darf den Rahmen (= Container-Balken) nie überschreiten.
  // Stufen: normal (links/rechts) → kleinere Schrift (links/rechts) → nur Markierung.
  // Die Breiten kommen aus einer Canvas-Textmessung (Naturbreite je Stufe), NICHT aus dem
  // gerenderten Kasten → die Entscheidung hängt nicht vom aktuellen Zustand ab (oszillationsfrei).
  _computePointLayout(overlay) {
    const map = {};
    for (const ev of this.data.items) {
      if (ev.kind !== 'event' || ev.end || !ev.personId) continue;   // nur Kind-Zeitpunkte
      if (!this.visibleIds.has(ev.id)) continue;
      const er = this._rect(ev.id, overlay);
      const cr = this._rect(ev.personId, overlay);   // Lebensbalken/Container
      if (!er || !cr) continue;

      const cur = this.pointAlignState[ev.id] || {};
      // wahrer Datums-X: die verankerte Kante liegt unabhängig von der Größenstufe auf dem Datum
      const dateX = (cur.align || 'left') === 'right' ? er.x + er.w : er.x;
      const cL = cr.x, cR = cr.x + cr.w;
      const wNormal = this._naturalWidth(ev.title, 'normal');
      const wSmall = this._naturalWidth(ev.title, 'small');

      if (dateX + wNormal <= cR)      map[ev.id] = { align: 'left',  size: 'normal' };
      else if (dateX - wNormal >= cL) map[ev.id] = { align: 'right', size: 'normal' };
      else if (dateX + wSmall <= cR)  map[ev.id] = { align: 'left',  size: 'small' };
      else if (dateX - wSmall >= cL)  map[ev.id] = { align: 'right', size: 'small' };
      else if (dateX + DOT_W <= cR)   map[ev.id] = { align: 'left',  size: 'dot' };
      else                            map[ev.id] = { align: 'right', size: 'dot' };
    }
    return map;
  }

  // Naturbreite eines Zeitpunkt-Kastens in einer Größenstufe: Textbreite (Canvas) + Padding,
  // gekappt auf die max-width der Stufe; +2px Toleranz gegen Subpixel-Differenzen zum DOM.
  _naturalWidth(title, size) {
    if (!this._ctx) this._ctx = document.createElement('canvas').getContext('2d');
    if (!this._fontBase) {
      const probe = this.tlContainer.querySelector('.vis-item .vis-item-content');
      const cs = probe && getComputedStyle(probe);
      this._fontBase = { family: cs ? cs.fontFamily : 'sans-serif', weight: cs ? cs.fontWeight : '600' };
    }
    const m = MEASURE[size];
    this._ctx.font = `${this._fontBase.weight} ${m.font}px ${this._fontBase.family}`;
    return Math.min(this._ctx.measureText(String(title || '')).width + m.padX, m.maxW) + 2;
  }

  // Kleiner Pfeil-Marker: Spitze exakt auf dem Datum, Körper ragt nach außen.
  _drawArrows(overlay) {
    const P = 6;   // wie weit der Pfeil heraus­ragt
    const H = 5;   // halbe Pfeilhöhe
    for (const ev of this.data.items) {
      if (ev.kind !== 'event' || ev.end || !this.visibleIds.has(ev.id)) continue; // nur Zeitpunkte
      const er = this._rect(ev.id, overlay);
      if (!er) continue;
      const right = (this.pointAlignState[ev.id] || {}).align === 'right';
      const dateX = right ? er.x + er.w : er.x;
      const cy = er.y + er.h / 2;
      const tip = dateX;                          // Spitze auf dem Datum
      const base = right ? dateX + P : dateX - P; // Körper ragt nach außen
      const color = getEntryColor(ev, this.activeFilters, this.data);

      const g = document.createElementNS(SVG_NS, 'g');
      g.classList.add('ov');
      const tri = document.createElementNS(SVG_NS, 'path');
      tri.setAttribute('d', `M ${tip} ${cy} L ${base} ${cy - H} L ${base} ${cy + H} Z`);
      tri.setAttribute('fill', color);
      tri.setAttribute('class', 'pkm-ev-marker');
      g.appendChild(tri);
      this.svg.appendChild(g);
    }
  }

  _drawFrames(overlay) {
    // Container = alle Personen + Welt-Ereignisse, die Kind-Ereignisse haben
    const containers = [
      ...persons(this.data),
      ...worldEvents(this.data).filter((e) => eventsOf(this.data, e.id).length > 0),
    ];
    for (const p of containers) {
      if (!this.visibleIds.has(p.id)) continue;
      const rects = [];
      const own = this._rect(p.id, overlay);
      if (own) rects.push(own);
      for (const ev of this.data.items) {
        if (ev.kind === 'event' && ev.personId === p.id && this.visibleIds.has(ev.id)) {
          const r = this._rect(ev.id, overlay);
          if (r) rects.push(r);
        }
      }
      if (rects.length < 1) continue;

      // Rahmenbreite = Container-Balken (Lebensbalken/Ereignis-Balken), NICHT die Kinder:
      // die Kinder werden per Layout-Stufen (_computePointLayout) in den Rahmen gezwungen.
      // Vertikal weiterhin eng um den gesamten Inhalt → zentriert.
      const x = own ? own.x : Math.min(...rects.map((r) => r.x));
      const right = own ? own.x + own.w : Math.max(...rects.map((r) => r.x + r.w));

      const inset = 3;
      const y = Math.min(...rects.map((r) => r.y)) - inset;
      const bottom = Math.max(...rects.map((r) => r.y + r.h)) + inset;
      const color = getEntryColor(p, this.activeFilters, this.data);

      const g = document.createElementNS(SVG_NS, 'g');
      g.classList.add('ov');
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', x); rect.setAttribute('y', y);
      rect.setAttribute('width', Math.max(0, right - x));
      rect.setAttribute('height', Math.max(0, bottom - y));
      rect.setAttribute('rx', 6);
      rect.setAttribute('class', 'pkm-frame');
      rect.setAttribute('fill', rgba(color, 0.05));
      rect.setAttribute('stroke', rgba(color, 0.5));
      g.appendChild(rect);
      this.svg.appendChild(g);
    }
  }

  _drawConnections(overlay) {
    for (const conn of this.data.connections) {
      if (!this.visibleIds.has(conn.fromId) || !this.visibleIds.has(conn.toId)) continue;
      const ra = this._rect(conn.fromId, overlay);
      const rb = this._rect(conn.toId, overlay);
      if (!ra || !rb) continue;

      const aC = ra.x + ra.w / 2, bC = rb.x + rb.w / 2;
      const toRight = bC >= aC;
      const ax = toRight ? ra.x + ra.w : ra.x;
      const bx = toRight ? rb.x : rb.x + rb.w;
      const ay = ra.y + ra.h / 2;
      const by = rb.y + rb.h / 2;
      const dx = Math.max(26, Math.abs(bx - ax) / 2);
      const c1 = toRight ? ax + dx : ax - dx;
      const c2 = toRight ? bx - dx : bx + dx;

      const g = document.createElementNS(SVG_NS, 'g');
      g.classList.add('ov');
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', `M ${ax} ${ay} C ${c1} ${ay}, ${c2} ${by}, ${bx} ${by}`);
      path.setAttribute('class', 'conn-path');
      path.setAttribute('marker-end', 'url(#arrow)');
      path.addEventListener('click', (e) => { e.stopPropagation(); this.cb.onConnClick(conn.id); });
      g.appendChild(path);

      const text = this._label(conn);
      if (text) {
        const mx = (ax + bx) / 2, my = (ay + by) / 2 - 6;
        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('x', mx); t.setAttribute('y', my);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'conn-label');
        t.textContent = text;
        g.appendChild(t);
      }
      this.svg.appendChild(g);
    }
  }

  _label(conn) {
    const rel = conn.relation && conn.relation !== 'verbunden' ? conn.relation : '';
    return [rel, conn.label].filter(Boolean).join(': ');
  }

  _rect(id, overlay) {
    const el = this.tlContainer.querySelector('.vis-item.id-' + cssEscape(id) + ':not(.vis-dot):not(.vis-line)');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - overlay.left, y: r.top - overlay.top, w: r.width, h: r.height };
  }
}

function cssEscape(s) { return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
