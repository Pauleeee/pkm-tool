// "Gruppieren nach"-Steuerung (C5): Umschalter zwischen Person/Ereignis
// (Standard), Kategorie und Land, plus Panel zum Umsortieren (▲▼) und
// Ein-/Ausblenden (👁) der jeweiligen Sektionen. Reine View-Schicht — liest/
// schreibt data.meta.groupBy/groupOrder/groupHidden direkt, meldet Änderungen
// über cb.onChange() (main.js kümmert sich um render()+persist()).

import { sectionLabel, effectiveSectionOrder } from './model.js?v=21';

const MODES = [['kind', 'Person/Ereignis'], ['category', 'Kategorie'], ['land', 'Land']];

export class GroupBar {
  constructor(el, cb) {
    this.el = el;
    this.cb = cb; // { onChange() }
    this.data = null;
    this.panelOpen = false;
    this._outsideClick = (e) => {
      if (!this.panelOpen) return;
      if (e.target.closest('.group-trigger')) return;
      this.panelOpen = false; this.render();
    };
  }

  setData(data) { this.data = data; this.render(); }

  render() {
    this.el.innerHTML = '';
    this.el.appendChild(this._trigger());
    document.removeEventListener('mousedown', this._outsideClick);
    if (this.panelOpen) document.addEventListener('mousedown', this._outsideClick);
  }

  _mode() { return this.data.meta.groupBy || 'kind'; }

  _trigger() {
    const wrap = el('span', 'group-trigger');
    const btn = el('button', 'btn' + (this.panelOpen ? ' active' : ''));
    btn.type = 'button';
    const modeLabel = (MODES.find(([v]) => v === this._mode()) || MODES[0])[1];
    btn.textContent = `⊞ Gruppieren: ${modeLabel}`;
    btn.addEventListener('click', () => { this.panelOpen = !this.panelOpen; this.render(); });
    wrap.appendChild(btn);
    if (this.panelOpen) wrap.appendChild(this._panel());
    return wrap;
  }

  _panel() {
    const d = this.data;
    const mode = this._mode();
    const panel = el('div', 'group-panel');

    const modeRow = el('div', 'group-mode-row');
    MODES.forEach(([v, t]) => {
      const b = el('button', 'chip' + (mode === v ? ' active' : ''));
      b.type = 'button'; b.textContent = t;
      b.addEventListener('click', () => {
        d.meta.groupBy = v;
        this.render(); this.cb.onChange();
      });
      modeRow.appendChild(b);
    });
    panel.appendChild(modeRow);
    panel.appendChild(this._sortRow(mode));

    panel.appendChild(elText('div', 'filter-panel-section-label', 'Sektionen'));
    const order = effectiveSectionOrder(mode, d);
    const hidden = new Set((d.meta.groupHidden && d.meta.groupHidden[mode]) || []);
    const manual = this._sort(mode).by === 'manual';   // nur dann ▲▼ aktiv
    if (!order.length) {
      panel.appendChild(elText('div', 'muted', 'Keine Sektionen vorhanden.'));
    }
    order.forEach((key, i) => panel.appendChild(this._sectionRow(mode, key, i, order.length, hidden.has(key), manual)));

    return panel;
  }

  _sort(mode) { return (this.data.meta.groupSort && this.data.meta.groupSort[mode]) || { by: 'manual', dir: 1 }; }

  // Sortierkriterium der Sektionen: Manuell (▲▼) · Alphabetisch · Anzahl · Frühestes Datum, + Richtung.
  _sortRow(mode) {
    const d = this.data;
    const cur = this._sort(mode);
    const row = el('div', 'group-sort-row');
    row.appendChild(elText('span', 'group-sort-label', 'Sortieren'));
    const sel = document.createElement('select');
    sel.className = 'group-sort-select';
    [['manual', 'Manuell (▲▼)'], ['label', 'Alphabetisch'], ['count', 'Anzahl Einträge'], ['earliest', 'Frühestes Datum']]
      .forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === cur.by) o.selected = true; sel.appendChild(o); });
    const write = (by, dir) => { d.meta.groupSort = d.meta.groupSort || {}; d.meta.groupSort[mode] = { by, dir }; this.render(); this.cb.onChange(); };
    sel.addEventListener('change', () => write(sel.value, cur.dir || 1));
    row.appendChild(sel);
    const dirBtn = el('button', 'sub-mini');
    dirBtn.type = 'button'; dirBtn.textContent = (cur.dir || 1) < 0 ? '↓' : '↑';
    dirBtn.title = 'Richtung umkehren'; dirBtn.disabled = cur.by === 'manual';
    dirBtn.addEventListener('click', () => write(cur.by, (cur.dir || 1) * -1));
    row.appendChild(dirBtn);
    return row;
  }

  _sectionRow(mode, key, i, total, isHidden, manual = true) {
    const d = this.data;
    const row = el('div', 'group-sec-row');

    const eye = el('button', 'sub-mini');
    eye.type = 'button'; eye.textContent = isHidden ? '🚫' : '👁';
    eye.title = isHidden ? 'Sektion einblenden' : 'Sektion ausblenden';
    eye.addEventListener('click', () => {
      d.meta.groupHidden = d.meta.groupHidden || {};
      const set = new Set(d.meta.groupHidden[mode] || []);
      set.has(key) ? set.delete(key) : set.add(key);
      d.meta.groupHidden[mode] = [...set];
      this.render(); this.cb.onChange();
    });
    row.appendChild(eye);

    const name = elText('span', 'group-sec-name', sectionLabel(mode, key, d));
    if (isHidden) name.style.opacity = '.45';
    row.appendChild(name);

    // ▲▼ nur im Manuell-Modus (bei Auto-Sortierung bestimmt das Kriterium die Reihenfolge)
    if (manual) {
      const up = el('button', 'sub-mini'); up.type = 'button'; up.textContent = '▲'; up.disabled = i === 0;
      up.title = 'Sektion nach oben';
      up.addEventListener('click', () => this._reorder(mode, i, -1));
      row.appendChild(up);

      const down = el('button', 'sub-mini'); down.type = 'button'; down.textContent = '▼'; down.disabled = i === total - 1;
      down.title = 'Sektion nach unten';
      down.addEventListener('click', () => this._reorder(mode, i, 1));
      row.appendChild(down);
    }

    return row;
  }

  _reorder(mode, i, dir) {
    const d = this.data;
    const order = effectiveSectionOrder(mode, d);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    d.meta.groupOrder = d.meta.groupOrder || {};
    d.meta.groupOrder[mode] = order;
    this.render(); this.cb.onChange();
  }
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function elText(tag, cls, txt) { const e = el(tag, cls); e.textContent = txt; return e; }
