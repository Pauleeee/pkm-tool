// Quellen-Tab (Plan Phase 6): quellenzentrierter Arbeitsbereich neben der Zeitleiste.
// Links eine durchsuchbare Quellenliste, rechts zur gewählten Quelle:
//   • Metadaten (Bearbeiten öffnet das bestehende openSourceForm-Modal)
//   • freie Notizen (Markdown-light, gerendert über mdLite)
//   • „Verwendet in" (Backlinks aus itemsUsingSource) — Klick springt in die Zeitleiste
//   • „Ereignis binden" — hängt bestehenden Einträgen einen ref auf diese Quelle an
// Reine View-Schicht: liest data, meldet Änderungen über cb (main.js persistiert + rendert).

import { sortedSources, sourceLabel, authorName, itemsUsingSource } from './model.js?v=21';
import { mdLite } from './ui.js?v=21';

export class SourcesView {
  constructor(el, cb) {
    this.el = el;
    this.cb = cb; // { onChange(), onFocusItem(id), onEditSource(source) }
    this.data = null;
    this.selectedId = null;
    this.query = '';
  }

  setData(data) { this.data = data; this.render(); }
  select(id) { this.selectedId = id; this.render(); }

  render() {
    if (!this.data) return;
    this.el.innerHTML = '';
    const wrap = el('div', 'sources-wrap');
    wrap.appendChild(this._list());
    wrap.appendChild(this._detail());
    this.el.appendChild(wrap);
  }

  // ---- linke Spalte: Suche + Liste ----
  _list() {
    const col = el('div', 'sources-list');

    const search = document.createElement('input');
    search.type = 'search'; search.className = 'search-input sources-search';
    search.placeholder = 'Quelle suchen…'; search.value = this.query;
    search.addEventListener('input', () => { this.query = search.value; this._refreshList(col); });
    col.appendChild(search);

    const add = el('button', 'btn btn-primary sources-add');
    add.type = 'button'; add.textContent = '＋ Neue Quelle';
    add.addEventListener('click', () => this.cb.onEditSource(null));
    col.appendChild(add);

    const ul = el('div', 'sources-items');
    col.appendChild(ul);
    this._refreshList(col);
    return col;
  }

  _refreshList(col) {
    const ul = col.querySelector('.sources-items');
    if (!ul) return;
    ul.innerHTML = '';
    const q = this.query.trim().toLowerCase();
    let sources = sortedSources(this.data);
    if (q) sources = sources.filter((s) => (sourceLabel(s) + ' ' + (s.notes || '')).toLowerCase().includes(q));
    if (!sources.length) { ul.appendChild(elText('div', 'muted', 'Keine Quellen.')); return; }
    sources.forEach((s) => {
      const count = itemsUsingSource(this.data, s.id).length;
      const row = el('button', 'sources-item' + (s.id === this.selectedId ? ' active' : ''));
      row.type = 'button';
      row.appendChild(elText('span', 'sources-item-title', sourceLabel(s)));
      const meta = elText('span', 'sources-item-meta', `${s.kind} · ${count}×`);
      row.appendChild(meta);
      row.addEventListener('click', () => this.select(s.id));
      ul.appendChild(row);
    });
  }

  // ---- rechte Spalte: Detail der gewählten Quelle ----
  _detail() {
    const col = el('div', 'sources-detail');
    const src = this.data.sources.find((s) => s.id === this.selectedId);
    if (!src) {
      col.appendChild(elText('div', 'detail-empty', 'Wähle links eine Quelle – oder lege eine neue an.'));
      return col;
    }

    const head = el('div', 'sources-detail-head');
    head.appendChild(elText('h2', '', src.title));
    const sub = authorName(src);
    head.appendChild(elText('div', 'sources-sub', [sub, src.kind, src.year].filter(Boolean).join(' · ')));
    const edit = el('button', 'btn sources-edit');
    edit.type = 'button'; edit.textContent = '✎ Bearbeiten';
    edit.addEventListener('click', () => this.cb.onEditSource(src));
    head.appendChild(edit);
    col.appendChild(head);

    col.appendChild(this._notes(src));
    col.appendChild(this._usedIn(src));
    col.appendChild(this._bind(src));
    return col;
  }

  // Notizen: Textarea (Markdown-light), gerendert per mdLite; Speichern beim Verlassen.
  _notes(src) {
    const box = el('div', 'sources-section');
    box.appendChild(elText('div', 'sources-section-label', 'Notizen'));

    const ta = document.createElement('textarea');
    ta.className = 'sources-notes'; ta.value = src.notes || '';
    ta.placeholder = 'Freie Notizen zu dieser Quelle…';
    const preview = el('div', 'sources-notes-preview md-body');
    const renderPreview = () => { preview.innerHTML = mdLite(ta.value) || '<span class="muted">Vorschau…</span>'; };
    ta.addEventListener('input', renderPreview);
    ta.addEventListener('blur', () => {
      if ((src.notes || '') === ta.value) return;
      src.notes = ta.value;
      this.cb.onChange();   // persistiert; render() setzt die Liste/Detail neu
    });
    renderPreview();
    box.appendChild(ta);
    box.appendChild(elText('div', 'md-hint', 'Formatierung: **fett** · *kursiv* · `code` · [Link](https://…) · „- " Liste'));
    box.appendChild(preview);
    return box;
  }

  // Backlinks: alle Einträge, die diese Quelle referenzieren
  _usedIn(src) {
    const box = el('div', 'sources-section');
    const items = itemsUsingSource(this.data, src.id);
    box.appendChild(elText('div', 'sources-section-label', `Verwendet in (${items.length})`));
    if (!items.length) { box.appendChild(elText('div', 'muted', 'Noch keinem Eintrag zugeordnet.')); return box; }
    const ul = el('div', 'sources-links');
    items.forEach((it) => {
      const item = el('div', 'sources-link-item');
      const row = el('div', 'sources-link-row');
      const jump = el('button', 'link-btn');
      jump.type = 'button'; jump.textContent = (it.kind === 'person' ? '👤 ' : '◆ ') + it.title;
      jump.addEventListener('click', () => this.cb.onFocusItem(it.id));
      row.appendChild(jump);
      const rm = el('button', 'sub-mini'); rm.type = 'button'; rm.textContent = '✕';
      rm.title = 'Bindung lösen';
      rm.addEventListener('click', () => {
        it.refs = (it.refs || []).filter((r) => r.sourceId !== src.id);
        if (it.sourceId === src.id) it.sourceId = null;   // Alt-Feld mit lösen
        this.cb.onChange();
      });
      row.appendChild(rm);
      item.appendChild(row);
      // Fundstelle + Notiz dieser konkreten Verknüpfung (nicht die allgemeine Quellen-Notiz oben)
      const ref = (it.refs || []).find((r) => r.sourceId === src.id);
      if (ref && (ref.pages || ref.note)) {
        const detail = el('div', 'sources-link-detail');
        if (ref.pages) detail.appendChild(elText('div', 'muted', 'S./Kap. ' + ref.pages));
        if (ref.note) {
          const note = el('div', 'ref-note md-body');
          note.innerHTML = mdLite(ref.note);
          detail.appendChild(note);
        }
        item.appendChild(detail);
      }
      ul.appendChild(item);
    });
    box.appendChild(ul);
    return box;
  }

  // Ereignis binden: bestehenden Eintrag auswählen → ref auf diese Quelle anhängen
  _bind(src) {
    const box = el('div', 'sources-section');
    box.appendChild(elText('div', 'sources-section-label', 'Ereignis binden'));

    const used = new Set(itemsUsingSource(this.data, src.id).map((it) => it.id));
    const sel = document.createElement('select');
    sel.className = 'sources-bind-select';
    const first = document.createElement('option');
    first.value = ''; first.textContent = '— Eintrag wählen —'; sel.appendChild(first);
    // nach Kategorie gruppiert, nur noch nicht gebundene Einträge
    const buckets = [...this.data.categories.map((c) => [c.id, c.name]), [null, '(ohne Kategorie)']];
    let any = false;
    buckets.forEach(([cid, cname]) => {
      const members = this.data.items
        .filter((it) => !used.has(it.id) && (it.categoryId || null) === cid)
        .sort((a, b) => a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }));
      if (!members.length) return;
      any = true;
      const og = document.createElement('optgroup'); og.label = cname;
      members.forEach((it) => { const o = document.createElement('option'); o.value = it.id; o.textContent = (it.kind === 'person' ? '👤 ' : '◆ ') + it.title; og.appendChild(o); });
      sel.appendChild(og);
    });
    const rowEl = el('div', 'sources-bind-row');
    rowEl.appendChild(sel);
    const addBtn = el('button', 'btn'); addBtn.type = 'button'; addBtn.textContent = '＋ Binden';
    addBtn.addEventListener('click', () => {
      const id = sel.value; if (!id) return;
      const it = this.data.items.find((x) => x.id === id); if (!it) return;
      it.refs = it.refs || [];
      if (!it.refs.some((r) => r.sourceId === src.id)) it.refs.push({ sourceId: src.id, pages: '', quote: '' });
      this.cb.onChange();
    });
    rowEl.appendChild(addBtn);
    box.appendChild(rowEl);
    if (!any) box.appendChild(elText('div', 'muted', 'Alle Einträge sind bereits gebunden.'));
    return box;
  }
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function elText(tag, cls, txt) { const e = el(tag, cls); e.textContent = txt; return e; }
