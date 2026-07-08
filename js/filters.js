// Filter-/Legendenleiste: Suche, nach Kategorie (Farb-Legende), Unterkategorie
// (Chips) und Quelle (Dropdown, sortiert nach Autor-Nachnamen).
// Ausblenden versteckt die zugehörigen Einträge (eine ausgeblendete Person
// versteckt auch ihre Ereignisse).

import { byId, subcatColor, sortedSources, sourceLabel } from './model.js?v=20';

export class FilterBar {
  constructor(el, cb) {
    this.el = el;
    this.cb = cb; // { onChange(), onSearchSelect(id) }
    this.data = null;
    this.offCats = new Set();
    this.offSubs = new Set();
    this.sourceFilter = '';   // '' = alle Quellen, sonst eine source-id
    this.searchQuery = '';
  }

  setData(data) { this.data = data; this.render(); }

  focusSearch() { const i = this.el.querySelector('.search-input'); if (i) { i.focus(); i.select(); } }

  render() {
    const d = this.data;
    this.el.innerHTML = '';

    this.el.appendChild(this._searchBox());
    this.el.appendChild(sep());

    if (d.categories.length) {
      this.el.appendChild(label('Kategorien'));
      d.categories.forEach((c) => this.el.appendChild(this._chip({
        text: c.name, color: c.color, off: this.offCats.has(c.id),
        onToggle: () => toggle(this.offCats, c.id),
      })));
    }

    const subs = d.subcategories || [];
    if (subs.length) {
      this.el.appendChild(sep());
      this.el.appendChild(label('Unterkategorien'));
      subs.forEach((s) => this.el.appendChild(this._chip({
        text: s.name, color: subcatColor(d, s.id), off: this.offSubs.has(s.id),
        onToggle: () => toggle(this.offSubs, s.id),
      })));
    }

    if (d.sources.length) {
      this.el.appendChild(sep());
      this.el.appendChild(label('Quelle'));
      const sel = document.createElement('select');
      sel.className = 'filter-select';
      const opts = [['', '📖 Alle Quellen'], ...sortedSources(d).map((s) => [s.id, sourceLabel(s)])];
      opts.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === this.sourceFilter) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', () => { this.sourceFilter = sel.value; this.render(); this.cb.onChange(); });
      this.el.appendChild(sel);
    }

    // Rechts: „Zurücksetzen" (nur bei aktivem Filter) + Zähler „X / Y sichtbar"
    const meta = el('span', 'filter-meta');
    if (this._anyFilterActive()) {
      const reset = el('button', 'chip filter-reset');
      reset.type = 'button'; reset.textContent = '✕ Zurücksetzen';
      reset.addEventListener('click', () => {
        this.offCats.clear(); this.offSubs.clear(); this.sourceFilter = '';
        this.render(); this.cb.onChange();
      });
      meta.appendChild(reset);
    }
    meta.appendChild(elText('span', 'filter-count', `${this.visibleIds().size} sichtbar / ${d.items.length} gesamt`));
    this.el.appendChild(meta);
  }

  _anyFilterActive() {
    return this.offCats.size > 0 || this.offSubs.size > 0 || !!this.sourceFilter;
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

  _chip({ text, color, off, onToggle }) {
    const chip = document.createElement('span');
    chip.className = 'chip' + (off ? ' off' : '');
    if (color) { const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.background = color; chip.appendChild(sw); }
    chip.appendChild(document.createTextNode(text));
    chip.addEventListener('click', () => { onToggle(); this.render(); this.cb.onChange(); });
    return chip;
  }

  _itemPasses(it) {
    if (this.offCats.has(it.categoryId)) return false;
    if (!this._sourcePasses(it)) return false;
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

  // Aktive Filter für die Einfärbung (getEntryColor). Unser Filtermodell ist
  // „opt-out" (offCats/offSubs = ausgeblendet). Eine Dimension gilt als *aktiv*,
  // sobald in ihr überhaupt etwas ausgeblendet ist (der Nutzer filtert sie
  // gerade); aktiv sind dann die noch sichtbaren IDs. Nichts ausgeblendet →
  // leere Liste → getEntryColor nutzt die Fallback-Farbe.
  activeFilters() {
    const d = this.data;
    const cats = this.offCats.size > 0
      ? d.categories.filter((c) => !this.offCats.has(c.id)).map((c) => c.id)
      : [];
    const subs = this.offSubs.size > 0
      ? (d.subcategories || []).filter((s) => !this.offSubs.has(s.id)).map((s) => s.id)
      : [];
    return { categories: cats, subcategories: subs };
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
function label(txt) { const s = document.createElement('span'); s.className = 'filter-section-label'; s.textContent = txt; return s; }
function sep() { const s = document.createElement('span'); s.className = 'filter-sep'; return s; }
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function elText(tag, cls, txt) { const e = el(tag, cls); e.textContent = txt; return e; }
