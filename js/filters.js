// Filter-/Legendenleiste: nach Kategorie (Farb-Legende), Unterkategorie (Chips)
// und Quelle (Dropdown, sortiert nach Autor-Nachnamen).
// Ausblenden versteckt die zugehörigen Einträge (eine ausgeblendete Person
// versteckt auch ihre Ereignisse).

import { subcatColor, sortedSources, sourceLabel } from './model.js?v=17';

export class FilterBar {
  constructor(el, cb) {
    this.el = el;
    this.cb = cb; // { onChange() }
    this.data = null;
    this.offCats = new Set();
    this.offSubs = new Set();
    this.sourceFilter = '';   // '' = alle Quellen, sonst eine source-id
  }

  setData(data) { this.data = data; this.render(); }

  render() {
    const d = this.data;
    this.el.innerHTML = '';

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
      sel.addEventListener('change', () => { this.sourceFilter = sel.value; this.cb.onChange(); });
      this.el.appendChild(sel);
    }
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
    if (this.sourceFilter && it.sourceId !== this.sourceFilter) return false; // nur gewählte Quelle
    // Unterkategorie-Filter: sobald welche ausgeblendet sind, zeige nur Ereignisse mit
    // mindestens einer sichtbaren Unterkategorie (Ereignisse OHNE Unterkategorie fallen weg).
    if (it.kind === 'event' && this.offSubs.size > 0) {
      const subs = it.subcategoryIds || [];
      if (!subs.some((s) => !this.offSubs.has(s))) return false;
    }
    return true;
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
