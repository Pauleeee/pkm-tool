// Formulare/Modals und Detailpanel. Reine View-Schicht.

import {
  byId, persons, makeSource, makeCategory, makeSubcategory, itemColor, catName,
  subcatsOf, subcatName, subcatColor, getEntryColor, CATEGORY_PALETTE,
  SOURCE_KINDS, authorName, sourceLabel, sortedSources, fmtDate,
} from './model.js?v=20';

// ---------- Toast (kurze Meldung unten, optional mit Aktion z. B. „Rückgängig") ----------
let toastTimer = null;
export function showToast(text, opts = {}) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', 'toast');
  t.appendChild(elText('span', '', text));
  if (opts.actionLabel) {
    const b = el('button', 'toast-action');
    b.type = 'button'; b.textContent = opts.actionLabel;
    b.addEventListener('click', () => { t.remove(); if (opts.onAction) opts.onAction(); });
    t.appendChild(b);
  }
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), opts.duration || 6000);
}

// ---------- generisches Modal ----------
export function openModal(buildContent) {
  const root = document.getElementById('modal-root');
  const backdrop = el('div', 'modal-backdrop');
  const modal = el('div', 'modal');
  backdrop.appendChild(modal);
  const close = () => backdrop.remove();
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  modal.appendChild(buildContent(close));
  root.appendChild(backdrop);
  const first = modal.querySelector('input, select, textarea');
  if (first) first.focus();
  return close;
}

// ---------- Eintrag anlegen/bearbeiten ----------
export function openItemModal(data, item, cb) {
  openModal((close) => {
    const isNew = !item;
    const frag = el('form');
    frag.appendChild(h3(isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten'));

    const kind = selectField('Art', [['event', '◆ Ereignis'], ['person', '👤 Person']], item?.kind || 'event');
    const title = textField('Titel', item?.title || '');
    const startF = partialDateField('Beginn / Geburt', item?.start || '');
    const endF = partialDateField('Ende', item?.end || '', true);   // „läuft bis heute" erlaubt
    const dateRow = el('div', 'field-row'); dateRow.appendChild(startF.wrap); dateRow.appendChild(endF.wrap);

    const catOpts = data.categories.map((c) => [c.id, c.name]);
    const category = selectField('Kategorie (Farbe)', catOpts.length ? catOpts : [['', '— erst Kategorie anlegen —']], item?.categoryId || (data.categories[0]?.id || ''));
    // Unterkategorien: geordnete Chips (erste = primär, bestimmt die Farbe),
    // umsortierbar per ▲▼. Reihenfolge = subcategoryIds-Reihenfolge ([0] = primär).
    let selectedSubIds = [...(item?.subcategoryIds || [])];
    const subWrap = el('div', 'field');
    subWrap.appendChild(elText('label', '', 'Unterkategorien (erste = primär · Farbe)'));
    const subChosen = el('div', 'sub-chip-list');
    const subAdd = el('div', 'sub-chip-list sub-add-list');
    subWrap.appendChild(subChosen);
    subWrap.appendChild(subAdd);

    // Live-Farbfeld: resultierende Timeline-Farbe (Standardfarbe ohne aktiven Filter)
    const colorWrap = el('div', 'field');
    colorWrap.appendChild(elText('label', '', 'Farbe auf der Zeitleiste'));
    const colorPrev = el('div', 'color-preview');
    const colorSwatch = el('span', 'color-preview-swatch');
    const colorText = elText('span', 'muted', '');
    colorPrev.appendChild(colorSwatch); colorPrev.appendChild(colorText);
    colorWrap.appendChild(colorPrev);

    const updateColorPreview = () => {
      const draft = { categoryId: category.input.value, subcategoryIds: selectedSubIds };
      colorSwatch.style.background = getEntryColor(draft, { categories: [], subcategories: [] }, data);
      const primary = selectedSubIds[0];
      colorText.textContent = primary ? subcatName(data, primary) : (catName(data, category.input.value) || '—');
    };

    const miniBtn = (txt, disabled, onClick) => {
      const b = el('button', 'sub-mini'); b.type = 'button'; b.textContent = txt;
      if (disabled) b.disabled = true; else b.addEventListener('click', onClick);
      return b;
    };
    const moveSub = (id, dir) => {
      const i = selectedSubIds.indexOf(id), j = i + dir;
      if (i < 0 || j < 0 || j >= selectedSubIds.length) return;
      [selectedSubIds[i], selectedSubIds[j]] = [selectedSubIds[j], selectedSubIds[i]];
      renderSubs();
    };
    const renderSubs = () => {
      const subs = subcatsOf(data, category.input.value);
      // Kategorie gewechselt → verwaiste Unterkategorien entfernen
      selectedSubIds = selectedSubIds.filter((id) => subs.some((s) => s.id === id));
      subChosen.innerHTML = ''; subAdd.innerHTML = '';

      if (!subs.length) {
        subChosen.appendChild(elText('span', 'muted', 'Keine – im 🎨-Manager anlegen.'));
        updateColorPreview(); return;
      }

      selectedSubIds.forEach((id, idx) => {
        const chip = el('span', 'sub-chip');
        const sw = el('span', 'swatch'); sw.style.background = subcatColor(data, id); chip.appendChild(sw);
        chip.appendChild(document.createTextNode(subcatName(data, id)));
        if (idx === 0) chip.appendChild(elText('span', 'primar', 'primär · Farbe'));
        chip.appendChild(miniBtn('▲', idx === 0, () => moveSub(id, -1)));
        chip.appendChild(miniBtn('▼', idx === selectedSubIds.length - 1, () => moveSub(id, 1)));
        chip.appendChild(miniBtn('✕', false, () => { selectedSubIds = selectedSubIds.filter((x) => x !== id); renderSubs(); }));
        subChosen.appendChild(chip);
      });
      if (!selectedSubIds.length) subChosen.appendChild(elText('span', 'muted', 'Keine gewählt – unten hinzufügen.'));

      subs.filter((s) => !selectedSubIds.includes(s.id)).forEach((s) => {
        const chip = el('button', 'sub-chip sub-add'); chip.type = 'button';
        const sw = el('span', 'swatch'); sw.style.background = subcatColor(data, s.id); chip.appendChild(sw);
        chip.appendChild(document.createTextNode('＋ ' + s.name));
        chip.addEventListener('click', () => { selectedSubIds.push(s.id); renderSubs(); });
        subAdd.appendChild(chip);
      });

      updateColorPreview();
    };
    category.input.addEventListener('change', renderSubs);
    renderSubs();
    const owner = selectFieldGrouped('Gehört zu (Person oder Ereignis)',
      parentOptions(data, item?.id), item?.personId || '', ['', '🌍 Nichts – eigenständiges Ereignis']);

    // Quellen-Referenzen: mehrere je Eintrag, mit Seiten + optionalem Zitat
    let refs = (item?.refs || []).map((r) => ({ ...r }));
    const refsWrap = el('div', 'field');
    refsWrap.appendChild(elText('label', '', 'Quellen'));
    const refsList = el('div', 'ref-list');
    refsWrap.appendChild(refsList);
    const addRef = el('button', 'sub-chip sub-add'); addRef.type = 'button'; addRef.textContent = '＋ Quelle';
    addRef.addEventListener('click', () => {
      const first = sortedSources(data)[0];
      if (!first) return;
      refs.push({ sourceId: first.id, pages: '', quote: '' });
      renderRefs();
    });
    refsWrap.appendChild(addRef);
    const renderRefs = () => {
      refsList.innerHTML = '';
      if (!data.sources.length) {
        refsList.appendChild(elText('div', 'muted', 'Noch keine Quellen – im 📖-Manager anlegen.'));
        addRef.style.display = 'none';
        return;
      }
      if (!refs.length) refsList.appendChild(elText('div', 'muted', 'Keine Quelle verknüpft.'));
      refs.forEach((r, idx) => {
        const box = el('div', 'ref-box');
        const row1 = el('div', 'ref-row');
        const sel = document.createElement('select');
        sortedSources(data).forEach((s) => {
          const o = document.createElement('option'); o.value = s.id; o.textContent = sourceLabel(s);
          if (s.id === r.sourceId) o.selected = true; sel.appendChild(o);
        });
        sel.addEventListener('change', () => { r.sourceId = sel.value; });
        row1.appendChild(sel);
        const rm = el('button', 'sub-mini'); rm.type = 'button'; rm.textContent = '✕'; rm.title = 'Quelle entfernen';
        rm.addEventListener('click', () => { refs.splice(idx, 1); renderRefs(); });
        row1.appendChild(rm);
        box.appendChild(row1);
        const row2 = el('div', 'ref-row');
        const pages = document.createElement('input'); pages.type = 'text'; pages.placeholder = 'Seite(n), z. B. 12–14'; pages.value = r.pages || ''; pages.className = 'ref-pages';
        pages.addEventListener('input', () => { r.pages = pages.value; });
        const quote = document.createElement('input'); quote.type = 'text'; quote.placeholder = 'Zitat (optional)'; quote.value = r.quote || '';
        quote.addEventListener('input', () => { r.quote = quote.value; });
        row2.appendChild(pages); row2.appendChild(quote);
        box.appendChild(row2);
        refsList.appendChild(box);
      });
    };
    renderRefs();

    const desc = textareaField('Notiz / Beschreibung', item?.description || '');
    desc.wrap.appendChild(elText('div', 'md-hint', 'Formatierung: **fett** · *kursiv* · `code` · [Link](https://…) · „- " Liste'));

    frag.appendChild(kind.wrap);
    frag.appendChild(title.wrap);
    frag.appendChild(dateRow);
    frag.appendChild(category.wrap);
    frag.appendChild(subWrap);
    frag.appendChild(colorWrap);
    frag.appendChild(owner.wrap);
    frag.appendChild(refsWrap);
    frag.appendChild(desc.wrap);

    const sync = () => {
      const isPerson = kind.input.value === 'person';
      owner.wrap.style.display = isPerson ? 'none' : '';
      startF.wrap.querySelector('label').textContent = isPerson ? 'Geburt' : 'Beginn / Datum';
      endF.wrap.querySelector('label').textContent = isPerson ? 'Tod' : 'Ende (optional)';
    };
    kind.input.addEventListener('change', sync); sync();

    const err = el('div', 'form-error'); err.hidden = true;
    const showErr = (msg) => { err.textContent = msg; err.hidden = false; };
    const save = () => {
      const k = kind.input.value;
      const startVal = startF.getValue();
      if (!startVal) {
        showErr('Bitte mindestens das Jahr angeben.');
        startF.wrap.querySelector('.dp-year').focus();
        return;
      }
      cb.onSave({
        id: item?.id, kind: k,
        title: title.input.value.trim() || 'Ohne Titel',
        start: startVal,
        end: endF.getValue(),
        categoryId: category.input.value || null,
        subcategoryIds: selectedSubIds.filter((id) => subcatsOf(data, category.input.value).some((s) => s.id === id)),
        personId: k === 'event' ? (owner.input.value || null) : null,
        refs: refs.filter((r) => r.sourceId).map((r) => ({ sourceId: r.sourceId, pages: (r.pages || '').trim(), quote: (r.quote || '').trim() })),
        description: desc.input.value.trim(),
      });
      close();
    };
    frag.appendChild(err);
    frag.appendChild(actions({
      onDelete: isNew ? null : () => { cb.onDelete(item.id); close(); },
      onCancel: close,
      submit: true,
    }));
    frag.addEventListener('submit', (e) => { e.preventDefault(); save(); });
    return frag;
  });
}

// ---------- Verbindung ----------
export function openConnectionModal(data, conn, prefill, cb) {
  openModal((close) => {
    const isNew = !conn;
    const frag = el('form');
    frag.appendChild(h3(isNew ? 'Verbindung anlegen' : 'Verbindung bearbeiten'));
    const opts = data.items.map((i) => [i.id, (i.kind === 'person' ? '👤 ' : '◆ ') + i.title]);
    const from = selectField('Von', opts, conn?.fromId || prefill?.fromId || (opts[0] && opts[0][0]));
    const to = selectField('Nach', opts, conn?.toId || prefill?.toId || (opts[1] && opts[1][0]));
    const relation = selectField('Beziehung',
      ['verbunden', 'führt zu', 'verursacht', 'beeinflusst', 'trägt bei', 'gerichtet an', 'Kontext', 'widerspricht'].map((r) => [r, r]),
      conn?.relation || 'verbunden');
    const labelF = textField('Notiz (optional)', conn?.label || '');
    frag.appendChild(from.wrap); frag.appendChild(to.wrap); frag.appendChild(relation.wrap); frag.appendChild(labelF.wrap);
    const err = el('div', 'form-error'); err.hidden = true;
    const save = () => {
      if (from.input.value === to.input.value) { err.textContent = 'Von und Nach müssen verschieden sein.'; err.hidden = false; return; }
      cb.onSave({ id: conn?.id, fromId: from.input.value, toId: to.input.value, relation: relation.input.value, label: labelF.input.value.trim() });
      close();
    };
    frag.appendChild(err);
    frag.appendChild(actions({
      onDelete: isNew ? null : () => { cb.onDelete(conn.id); close(); },
      onCancel: close,
      submit: true,
    }));
    frag.addEventListener('submit', (e) => { e.preventDefault(); save(); });
    return frag;
  });
}

// ---------- Kategorien verwalten ----------
export function openCategoryManager(data, cb) {
  openModal((close) => {
    const frag = el('div');
    frag.appendChild(h3('Kategorien verwalten'));
    frag.appendChild(elText('p', 'muted', 'Farbe für Personen (z. B. Wissenschaftler/Politiker) und Ereignisse.'));
    const list = el('ul', 'manage-list');
    const refresh = () => {
      list.innerHTML = '';
      if (!data.categories.length) list.appendChild(elText('li', 'muted', 'Noch keine Kategorien.'));
      data.categories.forEach((c) => {
        const li = el('li');
        const color = document.createElement('input'); color.type = 'color'; color.value = toHex(c.color); color.style.width = '44px';
        color.addEventListener('input', () => { c.color = color.value; cb.onChange(); });
        const name = document.createElement('input'); name.type = 'text'; name.value = c.name; name.className = 'grow';
        name.addEventListener('change', () => { c.name = name.value.trim() || 'Kategorie'; cb.onChange(); });
        const del = linkBtn('löschen', 'danger', () => {
          if (cb.onSnapshot) cb.onSnapshot();
          // Kaskade: Unterkategorien der Kategorie entfernen und aus den
          // subcategoryIds-Arrays aller Items bereinigen
          const removedSubs = new Set((data.subcategories || []).filter((s) => s.categoryId === c.id).map((s) => s.id));
          data.categories = data.categories.filter((x) => x.id !== c.id);
          data.subcategories = (data.subcategories || []).filter((s) => s.categoryId !== c.id);
          data.items.forEach((it) => {
            if (it.categoryId === c.id) it.categoryId = null;
            if (it.subcategoryIds && it.subcategoryIds.length) it.subcategoryIds = it.subcategoryIds.filter((id) => !removedSubs.has(id));
          });
          cb.onChange(); refresh();
          showToast(`Kategorie „${c.name}" gelöscht — Cmd/Ctrl+Z (nach Schließen) macht rückgängig`);
        });
        li.appendChild(color); li.appendChild(name); li.appendChild(del);
        list.appendChild(li);

        // Unterkategorien (eingerückt)
        const subLi = el('li', 'sub-row');
        const subBox = el('div', 'sub-box');
        subcatsOf(data, c.id).forEach((s) => {
          const r = el('div', 'sub-item');
          const scol = document.createElement('input'); scol.type = 'color'; scol.value = toHex(s.color || c.color); scol.style.width = '38px';
          scol.title = 'Eigene Farbe der Unterkategorie';
          scol.addEventListener('input', () => { s.color = scol.value; cb.onChange(); });
          r.appendChild(scol);
          const sn = document.createElement('input'); sn.type = 'text'; sn.value = s.name; sn.className = 'grow';
          sn.addEventListener('change', () => { s.name = sn.value.trim() || 'Unterkategorie'; cb.onChange(); });
          r.appendChild(sn);
          r.appendChild(linkBtn('löschen', 'danger', () => {
            if (cb.onSnapshot) cb.onSnapshot();
            data.subcategories = data.subcategories.filter((x) => x.id !== s.id);
            data.items.forEach((it) => { it.subcategoryIds = (it.subcategoryIds || []).filter((id) => id !== s.id); });
            cb.onChange(); refresh();
            showToast(`Unterkategorie „${s.name}" gelöscht — Cmd/Ctrl+Z (nach Schließen) macht rückgängig`);
          }));
          subBox.appendChild(r);
        });
        subBox.appendChild(linkBtn('＋ Unterkategorie', '', () => {
          data.subcategories.push(makeSubcategory({ name: 'Unterkategorie', categoryId: c.id }));
          cb.onChange(); refresh();
        }));
        subLi.appendChild(subBox);
        list.appendChild(subLi);
      });
    };
    refresh();
    frag.appendChild(list);
    const add = btn('＋ Kategorie hinzufügen', '', () => {
      data.categories.push(makeCategory({ name: 'Neue Kategorie', color: CATEGORY_PALETTE[data.categories.length % CATEGORY_PALETTE.length] }));
      cb.onChange(); refresh();
    });
    const bar = el('div', 'modal-actions'); bar.appendChild(add);
    const right = el('div', 'right'); right.appendChild(btn('Fertig', 'btn-primary', close)); bar.appendChild(right);
    frag.appendChild(bar);
    return frag;
  });
}

// ---------- Quellen verwalten ----------
export function openSourceManager(data, cb) {
  openModal((close) => {
    const frag = el('div');
    frag.appendChild(h3('Quellen verwalten'));
    const list = el('ul', 'manage-list');
    const refresh = () => {
      list.innerHTML = '';
      if (!data.sources.length) list.appendChild(elText('li', 'muted', 'Noch keine Quellen.'));
      sortedSources(data).forEach((s) => {
        const li = el('li');
        const info = el('div', 'grow'); info.appendChild(elText('div', '', sourceLabel(s)));
        const sub = [s.kind, s.year, s.publisher || s.journal].filter(Boolean).join(' · ');
        if (sub) info.appendChild(elText('div', 'sub', sub));
        li.appendChild(info);
        li.appendChild(linkBtn('bearbeiten', '', () => openSourceForm(data, s, cb, refresh)));
        li.appendChild(linkBtn('löschen', 'danger', () => {
          if (cb.onSnapshot) cb.onSnapshot();
          data.sources = data.sources.filter((x) => x.id !== s.id);
          data.items.forEach((it) => { if (it.refs) it.refs = it.refs.filter((r) => r.sourceId !== s.id); });
          cb.onChange(); refresh();
          showToast(`Quelle „${s.title}" gelöscht — Cmd/Ctrl+Z (nach Schließen) macht rückgängig`);
        }));
        list.appendChild(li);
      });
    };
    refresh();
    frag.appendChild(list);
    const add = btn('＋ Quelle hinzufügen', '', () => { const s = makeSource(); data.sources.push(s); cb.onChange(); openSourceForm(data, s, cb, refresh); });
    const bar = el('div', 'modal-actions'); bar.appendChild(add);
    const right = el('div', 'right'); right.appendChild(btn('Fertig', 'btn-primary', close)); bar.appendChild(right);
    frag.appendChild(bar);
    return frag;
  });
}
function openSourceForm(data, s, cb, after) {
  openModal((close) => {
    const frag = el('form');
    frag.appendChild(h3('Quelle bearbeiten'));
    const kind = selectField('Art', SOURCE_KINDS.map((k) => [k, k]), s.kind);
    const title = textField('Titel', s.title);
    const last = textField('Nachname', s.authorLast);
    const first = textField('Vorname', s.authorFirst);
    const year = textField('Jahr', s.year);
    const publisher = textField('Verlag', s.publisher);
    const isbn = textField('ISBN', s.isbn);
    const journal = textField('Journal / Publikation', s.journal);
    const doi = textField('DOI', s.doi);
    const volume = textField('Band (Vol.)', s.volume);
    const issue = textField('Heft (Issue)', s.issue);
    const url = urlField('URL', s.url);
    const accessed = textField('Abgerufen am', s.accessed);
    const page = textField('Seite / Fundstelle', s.page);

    frag.appendChild(kind.wrap);
    frag.appendChild(title.wrap);
    const nameRow = el('div', 'field-row'); nameRow.appendChild(last.wrap); nameRow.appendChild(first.wrap);
    frag.appendChild(nameRow);
    const dyn = el('div'); frag.appendChild(dyn);   // kontextuelle Felder je nach Art
    frag.appendChild(page.wrap);

    const fieldRow = (...flds) => { const r = el('div', 'field-row'); flds.forEach((f) => r.appendChild(f)); return r; };
    const renderDyn = () => {
      dyn.innerHTML = '';
      const k = kind.input.value;
      if (k === 'Buch') { dyn.appendChild(fieldRow(publisher.wrap, year.wrap)); dyn.appendChild(isbn.wrap); }
      else if (k === 'Paper') { dyn.appendChild(journal.wrap); dyn.appendChild(fieldRow(year.wrap, doi.wrap)); dyn.appendChild(fieldRow(volume.wrap, issue.wrap)); }
      else if (k === 'Artikel') { dyn.appendChild(fieldRow(journal.wrap, year.wrap)); dyn.appendChild(url.wrap); }
      else if (k === 'Webseite') { dyn.appendChild(url.wrap); dyn.appendChild(fieldRow(year.wrap, accessed.wrap)); }
      else { dyn.appendChild(fieldRow(publisher.wrap, year.wrap)); dyn.appendChild(url.wrap); }
    };
    kind.input.addEventListener('change', renderDyn); renderDyn();

    const save = () => {
      s.kind = kind.input.value;
      s.title = title.input.value.trim() || 'Ohne Titel';
      s.authorLast = last.input.value.trim(); s.authorFirst = first.input.value.trim();
      s.year = year.input.value.trim(); s.page = page.input.value.trim();
      s.publisher = publisher.input.value.trim(); s.isbn = isbn.input.value.trim();
      s.journal = journal.input.value.trim(); s.doi = doi.input.value.trim();
      s.volume = volume.input.value.trim(); s.issue = issue.input.value.trim();
      s.url = url.input.value.trim(); s.accessed = accessed.input.value.trim();
      cb.onChange(); if (after) after(); close();
    };
    frag.appendChild(actions({ onCancel: close, submit: true }));
    frag.addEventListener('submit', (e) => { e.preventDefault(); save(); });
    return frag;
  });
}

// ---------- Detailpanel ----------
export function renderDetail(panel, item, data, cb) {
  panel.innerHTML = '';
  if (!item) {
    panel.innerHTML = '<div class="detail-empty"><div class="detail-empty-glyph">◷</div>' +
      '<p>Klicke einen Eintrag an,<br>um Details zu sehen.</p>' +
      '<p class="muted">Doppelklick auf eine freie Stelle legt ein neues Ereignis an.</p></div>';
    return;
  }
  const color = itemColor(item, data);
  const head = el('div', 'detail-head'); head.style.setProperty('--accent', color);
  head.appendChild(elText('h2', '', (item.kind === 'person' ? '👤 ' : '') + item.title));
  let sub = item.kind === 'person' ? 'Person' : (item.personId ? (byId(data.items, item.personId)?.title || 'Ereignis') : 'Welt-Ereignis');
  sub += ' · ' + catName(data, item.categoryId);
  head.appendChild(elText('div', 'detail-cat', sub));
  panel.appendChild(head);

  const when = item.end ? `${fmt(item.start)} – ${fmt(item.end)}` : fmt(item.start);
  panel.appendChild(detailRow('Zeit', document.createTextNode(when)));

  if (item.subcategoryIds && item.subcategoryIds.length) {
    const wrap = el('div', 'detail-themes');
    item.subcategoryIds.forEach((id) => {
      const name = subcatName(data, id);
      if (!name) return;
      const chip = el('span', 'chip');
      const sw = el('span', 'swatch'); sw.style.background = subcatColor(data, id);
      chip.appendChild(sw); chip.appendChild(document.createTextNode(name));
      wrap.appendChild(chip);
    });
    if (wrap.childNodes.length) panel.appendChild(detailRow('Unterkategorien', wrap));
  }

  if (item.description) {
    const note = el('div', 'md');
    note.innerHTML = mdLite(item.description);
    panel.appendChild(detailRow('Notiz', note));
  }

  const refs = (item.refs || []).map((r) => ({ r, src: byId(data.sources, r.sourceId) })).filter((x) => x.src);
  if (refs.length) {
    const wrap = el('div');
    refs.forEach(({ r, src }) => {
      const box = el('div', 'ref-detail');
      box.appendChild(elText('div', '', sourceLabel(src)));  // Nachname, Vorname – Titel
      // kontextuelle Detailzeile je nach Art
      let parts = [src.kind, src.year];
      if (src.kind === 'Buch') parts.push(src.publisher);
      else if (src.kind === 'Paper') parts.push(src.journal, src.doi && ('DOI ' + src.doi), [src.volume, src.issue].filter(Boolean).join('/'));
      else if (src.kind === 'Artikel') parts.push(src.journal);
      const line = parts.filter(Boolean).join(' · ');
      if (line) box.appendChild(elText('div', 'muted', line));
      const pages = r.pages || src.page;   // Seiten am Eintrag, sonst Fundstelle der Quelle
      if (pages) box.appendChild(elText('div', 'muted', 'S. ' + pages));
      if (src.isbn) box.appendChild(elText('div', 'muted', 'ISBN ' + src.isbn));
      if (src.url) {
        const a = document.createElement('a'); a.href = src.url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = 'Link öffnen' + (src.accessed ? ` (abgerufen ${src.accessed})` : '');
        box.appendChild(a);
      }
      if (r.quote) {
        const q = el('blockquote', 'ref-quote');
        q.textContent = `„${r.quote}"`;
        box.appendChild(q);
      }
      wrap.appendChild(box);
    });
    panel.appendChild(detailRow(refs.length > 1 ? 'Quellen' : 'Quelle', wrap));
  }

  if (item.kind === 'person') {
    const evs = data.items.filter((e) => e.kind === 'event' && e.personId === item.id)
      .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    if (evs.length) {
      const ul = el('ul', 'conn-list');
      evs.forEach((e) => {
        const li = el('li');
        const dot = el('span', 'mini-dot'); dot.style.background = itemColor(e, data);
        li.appendChild(dot);
        li.appendChild(elText('span', 'rel', ` ${fmt(e.start)}: `));
        li.appendChild(linkBtn(e.title, '', () => cb.onSelectItem(e.id)));
        ul.appendChild(li);
      });
      panel.appendChild(detailRow('Ereignisse', ul));
    }
  }

  const rels = data.connections.filter((c) => c.fromId === item.id || c.toId === item.id);
  if (rels.length) {
    const ul = el('ul', 'conn-list');
    rels.forEach((c) => {
      const otherId = c.fromId === item.id ? c.toId : c.fromId;
      const other = byId(data.items, otherId);
      const dir = c.fromId === item.id ? '→' : '←';
      const li = el('li');
      li.appendChild(elText('span', 'rel', `${dir} ${c.relation}${c.label ? ' (' + c.label + ')' : ''}: `));
      li.appendChild(linkBtn(other ? other.title : '(gelöscht)', '', () => cb.onSelectItem(otherId)));
      ul.appendChild(li);
    });
    panel.appendChild(detailRow('Verbindungen', ul));
  }

  const act = el('div', 'detail-actions');
  act.appendChild(btn('✎ Bearbeiten', 'btn-primary', () => cb.onEdit(item.id)));
  act.appendChild(btn('🔗 Verknüpfen', '', () => cb.onLinkFrom(item.id)));
  if (item.kind === 'person') {
    const collapsed = cb.isCollapsed ? cb.isCollapsed(item.id) : false;
    act.appendChild(btn(collapsed ? '▸ Ereignisse zeigen' : '▾ Ereignisse einklappen', '', () => cb.onToggleCollapse(item.id)));
  }
  panel.appendChild(act);

  // Vertikal verschieben: Person oder Welt-Ereignis → Zeile
  if ((item.kind === 'person' || (item.kind === 'event' && !item.personId)) && cb.onMovePerson) {
    const mv = el('div', 'detail-actions');
    mv.appendChild(elText('span', 'label', 'Zeile'));
    mv.appendChild(btn('▲ höher', '', () => cb.onMovePerson(item.id, -1)));
    mv.appendChild(btn('▼ tiefer', '', () => cb.onMovePerson(item.id, 1)));
    panel.appendChild(mv);
  }
  if (item.kind === 'event' && item.personId && cb.onMoveEvent) {
    const mv = el('div', 'detail-actions');
    mv.appendChild(elText('span', 'label', 'Unterzeile'));
    mv.appendChild(btn('▲ höher', '', () => cb.onMoveEvent(item.id, -1)));
    mv.appendChild(btn('▼ tiefer', '', () => cb.onMoveEvent(item.id, 1)));
    panel.appendChild(mv);
  }
}

// ---------- Markdown-light ----------
// Mini-Renderer für Notizen (nur Detailpanel): **fett**, *kursiv*, `code`,
// [Text](http…-Link), "- "-Listen, Zeilenumbrüche. Erst wird ALLES escaped,
// dann werden die Muster ersetzt → kein HTML/Script aus Nutzertext.
export function mdLite(text) {
  let s = String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  const out = [];
  let list = null;   // offene <ul>-Zeilen sammeln
  for (const line of s.split('\n')) {
    if (/^\s*-\s+/.test(line)) {
      (list = list || []).push('<li>' + line.replace(/^\s*-\s+/, '') + '</li>');
    } else {
      if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; }
      out.push(line);
    }
  }
  if (list) out.push('<ul>' + list.join('') + '</ul>');
  // Normale Zeilen mit <br> verbinden; vor/nach Listen keinen extra Umbruch
  return out.map((seg, i) => (seg.startsWith('<ul>') || i === out.length - 1 ? seg : seg + '<br>')).join('');
}

// ---------- Hilfe ----------
// Statischer Inhalt (kein Nutzertext) → innerHTML ist hier unbedenklich.
export function openHelp() {
  openModal((close) => {
    const frag = el('div', 'help');
    frag.innerHTML = `
      <h3>Hilfe &amp; Tastenkürzel</h3>
      <h4>Grundlagen</h4>
      <ul>
        <li><strong>Klick</strong> auf einen Eintrag → Details rechts im Panel.</li>
        <li><strong>Doppelklick auf eine freie Stelle</strong> → neues Ereignis an diesem Datum.</li>
        <li><strong>Doppelklick auf Person/Container</strong> → Ereignisse ein-/ausklappen; auf ein Ereignis → bearbeiten.</li>
        <li><strong>Ziehen</strong> (Person oder Welt-Ereignis, hoch/runter) → in andere Zeile verschieben. Beim Ziehen erscheinen <em>gestrichelte Einfüge-Zeilen</em>: Drop dorthin legt eine neue Zeile an. Feinsortierung auch per ▲▼ im Detailpanel.</li>
      </ul>
      <h4>Navigation (Trackpad/Maus)</h4>
      <ul>
        <li><strong>Pinch</strong> oder <strong>Cmd/Ctrl + Mausrad</strong> → zoomen (um den Cursor).</li>
        <li><strong>Zwei Finger links/rechts</strong> → Zeitfenster verschieben; <strong>hoch/runter</strong> → Seite scrollen.</li>
      </ul>
      <h4>Toolbar</h4>
      <ul>
        <li><strong>🔗 Verknüpfen</strong> — zwei Einträge nacheinander anklicken → Verbindungspfeil mit Beziehung.</li>
        <li><strong>↔ Verbindungen</strong> — Pfeile ein-/ausblenden · <strong>⊟ Einklappen</strong> — alle Container zu/auf · <strong>▒ Schattierung</strong> — Kontextbänder der Welt-Ereignisse.</li>
      </ul>
      <h4>Filter</h4>
      <ul>
        <li>Chips anklicken = Kategorie/Unterkategorie <em>ausblenden</em> (grau). <strong>Achtung:</strong> sobald Unterkategorien ausgeblendet sind, verschwinden auch Ereignisse <em>ohne</em> sichtbare Unterkategorie.</li>
        <li>„✕ Zurücksetzen" stellt alles wieder her; der Zähler zeigt „sichtbar / gesamt".</li>
      </ul>
      <h4>Tastenkürzel</h4>
      <table class="help-keys">
        <tr><td><kbd>n</kbd></td><td>Neuer Eintrag</td></tr>
        <tr><td><kbd>f</kbd></td><td>Alles einpassen</td></tr>
        <tr><td><kbd>/</kbd></td><td>Suche fokussieren</td></tr>
        <tr><td><kbd>Cmd/Ctrl</kbd>+<kbd>Z</kbd></td><td>Löschen/Import rückgängig</td></tr>
        <tr><td><kbd>Enter</kbd></td><td>Dialog speichern</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Dialog/Verknüpfungsmodus schließen</td></tr>
      </table>`;
    const bar = el('div', 'modal-actions');
    const right = el('div', 'right'); right.appendChild(btn('Schließen', 'btn-primary', close));
    bar.appendChild(right);
    frag.appendChild(bar);
    return frag;
  });
}

// ---------- DOM-Helfer ----------
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function elText(tag, cls, txt) { const e = el(tag, cls); e.textContent = txt; return e; }
function h3(t) { return elText('h3', '', t); }
function field(labelText, inputEl) { const wrap = el('div', 'field'); wrap.appendChild(elText('label', '', labelText)); wrap.appendChild(inputEl); return { wrap, input: inputEl }; }
function textField(l, v) { const i = document.createElement('input'); i.type = 'text'; i.value = v || ''; return field(l, i); }
function urlField(l, v) { const i = document.createElement('input'); i.type = 'url'; i.value = v || ''; i.placeholder = 'https://…'; return field(l, i); }
function dateField(l, v) { const i = document.createElement('input'); i.type = 'date'; i.value = v || ''; return field(l, i); }
function textareaField(l, v) { const i = document.createElement('textarea'); i.value = v || ''; return field(l, i); }

const MONTHS_SHORT = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
// Teil-Datum: Jahr Pflicht, Monat & Tag optional. getValue() → "YYYY" | "YYYY-MM" | "YYYY-MM-DD" | "now" | null
// allowNow: bietet zusätzlich „läuft bis heute" (Sonderwert "now").
function partialDateField(labelText, value, allowNow) {
  const wrap = el('div', 'field');
  wrap.appendChild(elText('label', '', labelText));
  const row = el('div', 'date-parts');
  const isNow = value === 'now';
  const parts = (value && !isNow) ? String(value).split('-') : [];
  const yi = document.createElement('input'); yi.type = 'number'; yi.placeholder = 'Jahr'; yi.value = parts[0] || ''; yi.className = 'dp-year';
  const mi = document.createElement('select'); mi.className = 'dp-month';
  [['', 'Monat'], ...MONTHS_SHORT.map((n, i) => [String(i + 1).padStart(2, '0'), n])].forEach(([v, t]) => {
    const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === parts[1]) o.selected = true; mi.appendChild(o);
  });
  const di = document.createElement('input'); di.type = 'number'; di.placeholder = 'Tag'; di.min = 1; di.max = 31; di.value = parts[2] ? String(+parts[2]) : ''; di.className = 'dp-day';
  row.appendChild(yi); row.appendChild(mi); row.appendChild(di);
  wrap.appendChild(row);

  let nowBox = null;
  if (allowNow) {
    const lab = el('label', 'check'); lab.style.marginTop = '6px';
    nowBox = document.createElement('input'); nowBox.type = 'checkbox'; nowBox.checked = isNow;
    const sync = () => { const on = nowBox.checked; [yi, mi, di].forEach((e) => { e.disabled = on; }); row.style.opacity = on ? '.4' : '1'; };
    nowBox.addEventListener('change', sync);
    lab.appendChild(nowBox); lab.appendChild(document.createTextNode(' läuft bis heute (Gegenwart)'));
    wrap.appendChild(lab);
    sync();
  }

  const getValue = () => {
    if (nowBox && nowBox.checked) return 'now';
    const yy = yi.value.trim(); if (!yy) return null;
    const mm = mi.value; const dd = di.value.trim();
    if (!mm) return yy;
    if (!dd) return `${yy}-${mm}`;
    return `${yy}-${mm}-${String(+dd).padStart(2, '0')}`;
  };
  return { wrap, getValue };
}
function selectField(l, options, value) {
  const s = document.createElement('select');
  options.forEach(([val, txt]) => { const o = document.createElement('option'); o.value = val; o.textContent = txt; if (val === value) o.selected = true; s.appendChild(o); });
  return field(l, s);
}
// Dropdown mit optgroups (nach Kategorie gruppiert)
function selectFieldGrouped(labelText, groups, value, firstOption) {
  const s = document.createElement('select');
  if (firstOption) { const o = document.createElement('option'); o.value = firstOption[0]; o.textContent = firstOption[1]; if (firstOption[0] === value) o.selected = true; s.appendChild(o); }
  groups.forEach((g) => {
    const og = document.createElement('optgroup'); og.label = g.label;
    g.options.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === value) o.selected = true; og.appendChild(o); });
    s.appendChild(og);
  });
  return field(labelText, s);
}
// Mögliche Eltern-Container (Personen + Welt-Ereignisse), nach Kategorie gruppiert,
// je Gruppe alphabetisch (Personen nach Nachname, Ereignisse nach Titel).
function parentOptions(data, excludeId) {
  const isCont = (it) => it.id !== excludeId && (it.kind === 'person' || (it.kind === 'event' && !it.personId));
  const key = (m) => (m.kind === 'person' ? (m.title.trim().split(/\s+/).pop() || m.title) : m.title);
  const groups = [];
  const buckets = [...data.categories.map((c) => [c.id, c.name]), [null, '(ohne Kategorie)']];
  buckets.forEach(([cid, cname]) => {
    const members = data.items.filter((it) => isCont(it) && (it.categoryId || null) === cid);
    if (!members.length) return;
    members.sort((a, b) => key(a).localeCompare(key(b), 'de', { sensitivity: 'base' }));
    groups.push({ label: cname, options: members.map((m) => [m.id, (m.kind === 'person' ? '👤 ' : '◆ ') + m.title]) });
  });
  return groups;
}
// submit:true → „Speichern" ist ein echter Submit-Button; das Formular ruft
// die Speichern-Logik in seinem submit-Handler auf (damit speichert auch Enter).
function actions({ onDelete, onCancel, onSave, submit }) {
  const bar = el('div', 'modal-actions');
  if (onDelete) bar.appendChild(btn('Löschen', 'btn-danger', onDelete));
  const right = el('div', 'right');
  right.appendChild(btn('Abbrechen', '', onCancel));
  if (submit) {
    const b = document.createElement('button');
    b.type = 'submit'; b.className = 'btn btn-primary'; b.textContent = 'Speichern';
    right.appendChild(b);
  } else {
    right.appendChild(btn('Speichern', 'btn-primary', onSave));
  }
  bar.appendChild(right);
  return bar;
}
function btn(txt, cls, onClick) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (cls || ''); b.textContent = txt; b.addEventListener('click', onClick); return b; }
function linkBtn(txt, cls, onClick) { const b = document.createElement('button'); b.type = 'button'; b.className = 'link-btn ' + (cls || ''); b.textContent = txt; b.addEventListener('click', onClick); return b; }
function detailRow(label, contentEl) { const row = el('div', 'detail-row'); row.appendChild(elText('span', 'label', label)); row.appendChild(contentEl); return row; }
function fmt(s) { return fmtDate(s); }
function toHex(c) { return /^#[0-9a-f]{6}$/i.test(c) ? c : '#6366f1'; }
