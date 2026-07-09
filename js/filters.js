// Filter-/Legendenleiste: Suche, sowie ein Filter-Panel (Baum aus Kategorien
// → Unterkategorien + Quelle). Ausblenden versteckt die zugehörigen
// Einträge (eine ausgeblendete Person versteckt auch ihre Ereignisse).
//
// Kategorie/Unterkategorie-Modell im Panel: hat eine Kategorie eigene
// Unterkategorien, ist NUR die Unterkategorie-Ebene der echte Filterzustand
// (offSubs) — die Hauptkategorie-Checkbox ist ein Sammel-Schalter, der alle
// zugehörigen Unterkategorien auf einmal umschaltet ("gemischt" bei
// Teilauswahl); `offCats` wird für sie automatisch nachgeführt
// (_syncCatFromSubs), damit die bestehende Sichtbarkeits-Logik
// (_itemPasses/visibleIds) unverändert bleibt. Kategorien OHNE eigene
// Unterkategorien behalten `offCats` als direkten, unabhängigen Filter.

import { byId, subcatColor, subcatsOf, sortedSources, sourceLabel, landsInUse } from './model.js?v=20';

export class FilterBar {
  constructor(el, cb) {
    this.el = el;
    this.cb = cb; // { onChange(), onSearchSelect(id) }
    this.data = null;
    this.offCats = new Set();
    this.offSubs = new Set();
    this.sourceFilter = '';   // '' = alle Quellen, sonst eine source-id
    this.landFilter = '';     // '' = alle Länder, sonst ein Ländername (COUNTRIES)
    this.searchQuery = '';
    this.panelOpen = false;
    this._outsideClick = (e) => {
      if (!this.panelOpen) return;
      if (e.target.closest('.filter-trigger')) return;
      this.panelOpen = false; this.render();
    };
  }

  setData(data) { this.data = data; this.render(); }

  focusSearch() { const i = this.el.querySelector('.search-input'); if (i) { i.focus(); i.select(); } }

  render() {
    const d = this.data;
    this.el.innerHTML = '';

    this.el.appendChild(this._searchBox());
    this.el.appendChild(sep());
    this.el.appendChild(this._filterTrigger());

    const lands = landsInUse(d);
    if (lands.length) {
      this.el.appendChild(sep());
      const landSel = document.createElement('select');
      landSel.className = 'filter-select';
      const opts = [['', '🌍 Alle Länder'], ...lands.map((l) => [l, l])];
      opts.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === this.landFilter) o.selected = true; landSel.appendChild(o); });
      landSel.addEventListener('change', () => { this.landFilter = landSel.value; this.render(); this.cb.onChange(); });
      this.el.appendChild(landSel);
    }

    // Rechts: „Zurücksetzen" (nur bei aktivem Filter) + Zähler „X / Y sichtbar"
    const meta = el('span', 'filter-meta');
    if (this._anyFilterActive()) {
      const reset = el('button', 'chip filter-reset');
      reset.type = 'button'; reset.textContent = '✕ Zurücksetzen';
      reset.addEventListener('click', () => {
        this.offCats.clear(); this.offSubs.clear(); this.sourceFilter = ''; this.landFilter = '';
        this.render(); this.cb.onChange();
      });
      meta.appendChild(reset);
    }
    meta.appendChild(elText('span', 'filter-count', `${this.visibleIds().size} sichtbar / ${d.items.length} gesamt`));
    this.el.appendChild(meta);

    document.removeEventListener('mousedown', this._outsideClick);
    if (this.panelOpen) document.addEventListener('mousedown', this._outsideClick);
  }

  // ---------- Filter-Panel (Kategorien-Baum + Quelle) ----------
  _activeFilterCount() {
    const d = this.data;
    const soloCats = d.categories.filter((c) => !subcatsOf(d, c.id).length && this.offCats.has(c.id)).length;
    return soloCats + this.offSubs.size + (this.sourceFilter ? 1 : 0);
  }

  _filterTrigger() {
    const wrap = el('span', 'filter-trigger');
    const btn = el('button', 'chip filter-trigger-btn' + (this.panelOpen ? ' active' : ''));
    btn.type = 'button';
    const count = this._activeFilterCount();
    btn.textContent = count ? `⚑ Filter · ${count}` : '⚑ Filter';
    btn.addEventListener('click', () => { this.panelOpen = !this.panelOpen; this.render(); if (this.panelOpen) this.el.querySelector('.filter-trigger-btn').focus(); });
    wrap.appendChild(btn);
    if (this.panelOpen) wrap.appendChild(this._filterPanel());
    return wrap;
  }

  _filterPanel() {
    const d = this.data;
    const panel = el('div', 'filter-panel');

    if (d.categories.length) {
      panel.appendChild(elText('div', 'filter-panel-section-label', 'Kategorien'));
      d.categories.forEach((c) => panel.appendChild(this._catTree(c)));
    }

    if (d.sources.length) {
      panel.appendChild(el('div', 'filter-panel-sep'));
      panel.appendChild(elText('div', 'filter-panel-section-label', 'Quelle'));
      const sel = document.createElement('select');
      sel.className = 'filter-select';
      const opts = [['', '📖 Alle Quellen'], ...sortedSources(d).map((s) => [s.id, sourceLabel(s)])];
      opts.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === this.sourceFilter) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', () => { this.sourceFilter = sel.value; this.render(); this.cb.onChange(); });
      panel.appendChild(sel);
    }

    return panel;
  }

  _catTree(cat) {
    const d = this.data;
    const subs = subcatsOf(d, cat.id);
    const wrap = el('div', 'filter-tree-cat');

    if (!subs.length) {
      // Keine Unterkategorien: die Hauptkategorie IST der (direkte) Filter.
      wrap.appendChild(this._treeRow({
        text: cat.name, color: cat.color, checked: !this.offCats.has(cat.id),
        onToggle: () => { toggle(this.offCats, cat.id); this.render(); this.cb.onChange(); },
      }));
      return wrap;
    }

    const allOff = subs.every((s) => this.offSubs.has(s.id));
    const noneOff = subs.every((s) => !this.offSubs.has(s.id));
    wrap.appendChild(this._treeRow({
      text: cat.name, color: cat.color, checked: !allOff, indeterminate: !allOff && !noneOff,
      onToggle: () => {
        if (allOff) subs.forEach((s) => this.offSubs.delete(s.id));
        else subs.forEach((s) => this.offSubs.add(s.id));
        this._syncCatFromSubs(cat.id);
        this.render(); this.cb.onChange();
      },
    }));
    subs.forEach((s) => wrap.appendChild(this._treeRow({
      text: s.name, color: subcatColor(d, s.id), checked: !this.offSubs.has(s.id), sub: true,
      onToggle: () => {
        toggle(this.offSubs, s.id);
        this._syncCatFromSubs(cat.id);
        this.render(); this.cb.onChange();
      },
    })));
    return wrap;
  }

  _treeRow({ text, color, checked, indeterminate, sub, onToggle }) {
    const row = el('label', 'filter-tree-row' + (sub ? ' sub' : ''));
    const box = document.createElement('input');
    box.type = 'checkbox'; box.checked = checked;
    if (indeterminate) box.indeterminate = true;
    box.addEventListener('change', onToggle);
    row.appendChild(box);
    if (color) { const sw = el('span', 'swatch'); sw.style.background = color; row.appendChild(sw); }
    row.appendChild(document.createTextNode(text));
    return row;
  }

  // Hält offCats für Kategorien MIT Unterkategorien im Gleichschritt mit
  // deren Unterkategorien-Zustand (aus = ALLE Unterkategorien aus) — rein
  // abgeleitet, kein eigener Nutzer-Zustand. _itemPasses bleibt dadurch
  // unverändert korrekt (liest offCats weiterhin direkt).
  _syncCatFromSubs(categoryId) {
    const subs = subcatsOf(this.data, categoryId);
    if (!subs.length) return;
    const allOff = subs.every((s) => this.offSubs.has(s.id));
    if (allOff) this.offCats.add(categoryId); else this.offCats.delete(categoryId);
  }

  _anyFilterActive() {
    return this.offCats.size > 0 || this.offSubs.size > 0 || !!this.sourceFilter || !!this.landFilter;
  }

  // ---------- Suche ----------
  // Sucht in Titel, Notiz und Quellen-Label; Trefferliste als Dropdown unterm
  // Feld. Klick/Enter springt zum Eintrag (cb.onSearchSelect). Treffer, die
  // gerade weggefiltert sind, erscheinen ausgegraut (kein Auto-Entfiltern).
  _searchBox() {
    const box = el('span', 'search-box');
    const input = document.createElement('input');
    input.type = 'search'; input.className = 'search-input';
    input.placeholder = 'Suchen…  ( / )';
    input.value = this.searchQuery;
    const results = el('div', 'search-results');
    results.hidden = true;
    box.appendChild(input); box.appendChild(results);

    const show = () => {
      const q = input.value.trim().toLowerCase();
      this.searchQuery = input.value;
      results.innerHTML = '';
      if (q.length < 2) { results.hidden = true; return; }
      const hits = this._searchMatches(q);
      if (!hits.length) {
        const row = el('div', 'search-hit muted'); row.textContent = 'Keine Treffer';
        results.appendChild(row);
      } else {
        const visible = this.visibleIds();
        for (const it of hits) {
          const row = el('div', 'search-hit' + (visible.has(it.id) ? '' : ' dim'));
          const icon = it.kind === 'person' ? '👤' : '◆';
          const year = it.start ? String(it.start).split('-')[0] : '';
          row.appendChild(elText('span', 'hit-title', `${icon} ${it.title}`));
          const meta = [year, visible.has(it.id) ? '' : 'ausgeblendet durch Filter'].filter(Boolean).join(' · ');
          if (meta) row.appendChild(elText('span', 'hit-meta', meta));
          // mousedown statt click: feuert vor dem blur des Suchfelds
          row.addEventListener('mousedown', (e) => { e.preventDefault(); results.hidden = true; this.cb.onSearchSelect(it.id); });
          results.appendChild(row);
        }
      }
      results.hidden = false;
    };
    input.addEventListener('input', show);
    input.addEventListener('focus', show);
    input.addEventListener('blur', () => setTimeout(() => { results.hidden = true; }, 150));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = this._searchMatches(input.value.trim().toLowerCase())[0];
        if (first) { results.hidden = true; this.cb.onSearchSelect(first.id); }
      } else if (e.key === 'Escape') {
        input.value = ''; this.searchQuery = ''; results.hidden = true; input.blur();
      }
    });
    return box;
  }

  _searchMatches(q) {
    if (!q || q.length < 2) return [];
    const d = this.data;
    const srcLabel = (it) => (it.refs || [])
      .map((r) => { const s = byId(d.sources, r.sourceId); return s ? sourceLabel(s) : ''; })
      .filter(Boolean).join(' ');
    const scored = [];
    for (const it of d.items) {
      const title = (it.title || '').toLowerCase();
      let score = -1;
      if (title.startsWith(q)) score = 0;
      else if (title.includes(q)) score = 1;
      else if ((it.description || '').toLowerCase().includes(q)) score = 2;
      else if (srcLabel(it).toLowerCase().includes(q)) score = 3;
      if (score >= 0) scored.push([score, it]);
    }
    scored.sort((a, b) => a[0] - b[0] || (a[1].title || '').localeCompare(b[1].title || '', 'de'));
    return scored.slice(0, 15).map(([, it]) => it);
  }

  _itemPasses(it) {
    if (this.offCats.has(it.categoryId)) return false;
    if (!this._sourcePasses(it)) return false;
    // Land-Filter: einfacher, direkter Feldvergleich (kein Kaskadieren zu
    // Kind-/Eltern-Elementen wie bei der Quelle — v1, ein Land pro Eintrag).
    if (this.landFilter && it.land !== this.landFilter) return false;
    // Unterkategorie-Filter: sobald welche ausgeblendet sind, zeige nur Ereignisse mit
    // mindestens einer sichtbaren Unterkategorie (Ereignisse OHNE Unterkategorie fallen weg).
    if (it.kind === 'event' && this.offSubs.size > 0) {
      const subs = it.subcategoryIds || [];
      if (!subs.some((s) => !this.offSubs.has(s))) return false;
    }
    return true;
  }

  // Quellen-Filter: Treffer, wenn IRGENDEINE Referenz auf die gewählte Quelle
  // zeigt. Container (Person/Welt-Ereignis) bleiben zusätzlich sichtbar, wenn
  // eines ihrer Kind-Ereignisse die Quelle referenziert — sonst würde das
  // passende Kind mit dem ausgeblendeten Container verschwinden.
  _sourcePasses(it) {
    if (!this.sourceFilter) return true;
    if ((it.refs || []).some((r) => r.sourceId === this.sourceFilter)) return true;
    if (it.kind === 'person' || !it.personId) {
      return this.data.items.some((c) => c.personId === it.id && (c.refs || []).some((r) => r.sourceId === this.sourceFilter));
    }
    return false;
  }

  visibleIds() {
    const d = this.data;
    const set = new Set();
    for (const it of d.items) {
      if (!this._itemPasses(it)) continue;
      if (it.kind === 'event' && it.personId) {
        const person = d.items.find((x) => x.id === it.personId);
        if (!person || !this._itemPasses(person)) continue;
      }
      set.add(it.id);
    }
    return set;
  }
}

function toggle(set, key) { set.has(key) ? set.delete(key) : set.add(key); }
function sep() { const s = document.createElement('span'); s.className = 'filter-sep'; return s; }
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function elText(tag, cls, txt) { const e = el(tag, cls); e.textContent = txt; return e; }
