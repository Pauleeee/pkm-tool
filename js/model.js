// Datenmodell, Factories, Farb-/Kontrast-Helfer und Seed-Daten.
//
// Zwei Arten von Einträgen (`kind`):
//   person — eigene Zeile/Spur; Lebensspanne (start+end) + ihre Ereignisse.
//            `order` bestimmt die vertikale Reihenfolge. `categoryId` → Farbe.
//   event  — Ereignis (start, optional end). `categoryId` → Farbe.
//            `personId` gesetzt  → gehört in die Zeile dieser Person.
//            `personId` leer     → Welt-Ereignis im Feld „Ereignisse" (Kriege, Natur …).
//
// `categories` ist eine eigene, vom Nutzer verwaltbare Liste (Name + Farbe),
// die sowohl Personen (Wissenschaftler/Politiker/…) als auch Ereignisse
// (politisch/wissenschaftlich/…) einfärbt.

export const CATEGORY_PALETTE = [
  '#6366f1', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6',
  '#0ea5e9', '#ec4899', '#f97316', '#14b8a6', '#a855f7',
];

const NEUTRAL = '#94a3b8';

// --- ID-Generierung ------------------------------------------------------
let counter = 0;
export function nextId(prefix = 'id') {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

// --- Leere Datenstruktur -------------------------------------------------
export function emptyData() {
  return { items: [], categories: [], subcategories: [], connections: [], sources: [], meta: { version: 5, updated: null } };
}

// --- Factories -----------------------------------------------------------
export function makeCategory(p = {}) {
  return { id: p.id || nextId('cat'), name: p.name || 'Neue Kategorie', color: p.color || CATEGORY_PALETTE[0] };
}

export function makeItem(p = {}) {
  const kind = p.kind || 'event';
  return {
    id: p.id || nextId('it'),
    kind,
    title: p.title || (kind === 'person' ? 'Neue Person' : 'Neues Ereignis'),
    start: p.start || null,
    end: p.end || null,
    categoryId: p.categoryId || null,
    // Mehrfachauswahl; migriert alten Einzelwert subcategoryId → subcategoryIds
    subcategoryIds: Array.isArray(p.subcategoryIds) ? p.subcategoryIds.slice() : (p.subcategoryId ? [p.subcategoryId] : []),
    personId: p.personId || null,          // nur event
    order: typeof p.order === 'number' ? p.order : 0,
    lane: typeof p.lane === 'number' ? p.lane : 0,   // person: vertikale Zeile
    row: typeof p.row === 'number' ? p.row : 0,      // event: Unterzeile in der Person
    // Quellen-Referenzen: MEHRERE je Eintrag, mit Seiten und optionalem Zitat.
    // Migriert das Alt-Feld sourceId (einzeln) → refs[0].
    refs: Array.isArray(p.refs)
      ? p.refs.map((r) => ({ sourceId: r.sourceId || null, pages: r.pages || '', quote: r.quote || '' })).filter((r) => r.sourceId)
      : (p.sourceId ? [{ sourceId: p.sourceId, pages: '', quote: '' }] : []),
    description: p.description || '',
  };
}

export function makeSubcategory(p = {}) {
  return { id: p.id || nextId('sub'), name: p.name || 'Unterkategorie', categoryId: p.categoryId || null, color: p.color || null };
}

export const SOURCE_KINDS = ['Buch', 'Paper', 'Artikel', 'Webseite', 'Sonstiges'];

export function makeSource(p = {}) {
  // Migration vom alten Einzelfeld `author` → authorFirst/authorLast
  let af = p.authorFirst, al = p.authorLast;
  if (af === undefined && al === undefined && p.author) {
    const parts = String(p.author).trim().split(/\s+/);
    al = parts.pop() || '';
    af = parts.join(' ');
  }
  return {
    id: p.id || nextId('src'),
    title: p.title || 'Neue Quelle',
    authorFirst: af || '',
    authorLast: al || '',
    kind: p.kind || 'Buch',
    year: p.year || '',
    page: p.page || '',
    // Buch
    publisher: p.publisher || '',
    isbn: p.isbn || '',
    // Paper / Artikel
    journal: p.journal || '',
    doi: p.doi || '',
    volume: p.volume || '',
    issue: p.issue || '',
    // Webseite
    url: p.url || '',
    accessed: p.accessed || '',
  };
}

// "Nachname, Vorname" bzw. nur was vorhanden ist
export function authorName(src) {
  const l = (src.authorLast || '').trim(), f = (src.authorFirst || '').trim();
  if (l && f) return `${l}, ${f}`;
  return l || f || '';
}
// "Nachname, Vorname – Titel"
export function sourceLabel(src) {
  const a = authorName(src);
  return a ? `${a} – ${src.title}` : src.title;
}
// Quellen nach Autor-Nachnamen sortiert (Fallback: Titel)
export function sortedSources(data) {
  return [...data.sources].sort((a, b) =>
    (a.authorLast || a.title).localeCompare(b.authorLast || b.title, 'de', { sensitivity: 'base' }));
}

export function makeConnection(p = {}) {
  return { id: p.id || nextId('cn'), fromId: p.fromId, toId: p.toId, label: p.label || '', relation: p.relation || 'verbunden' };
}

// --- Nachschlage- & Farb-Helfer -----------------------------------------
export function byId(list, id) { return list.find((x) => x.id === id) || null; }

export function persons(data) {
  return data.items.filter((i) => i.kind === 'person').sort((a, b) => (a.order || 0) - (b.order || 0));
}
// „Welt-Ereignisse" = Ereignisse OHNE Eltern (oberste Ebene, eigene Zeilen).
export function worldEvents(data) { return data.items.filter((i) => i.kind === 'event' && !i.personId); }
// Kinder eines Containers (personId ist das generische Eltern-Feld: Person ODER Ereignis).
export function eventsOf(data, parentId) { return data.items.filter((i) => i.kind === 'event' && i.personId === parentId); }

// Ein „Container" hält Kind-Ereignisse in einem Rahmen: eine Person oder ein
// Ereignis auf oberster Ebene (ohne Eltern).
export function isContainer(item) {
  return item.kind === 'person' || (item.kind === 'event' && !item.personId);
}
export function parentOf(data, item) { return item.personId ? byId(data.items, item.personId) : null; }

export function catColor(data, categoryId) {
  const c = byId(data.categories, categoryId);
  return c ? c.color : NEUTRAL;
}
export function catName(data, categoryId) {
  const c = byId(data.categories, categoryId);
  return c ? c.name : '—';
}
export function itemColor(item, data) { return catColor(data, item.categoryId); }

export function subcatsOf(data, categoryId) {
  return (data.subcategories || []).filter((s) => s.categoryId === categoryId);
}
export function subcatName(data, id) {
  const s = byId(data.subcategories || [], id);
  return s ? s.name : '';
}
// Eigene Farbe der Unterkategorie, sonst die der Oberkategorie.
export function subcatColor(data, id) {
  const s = byId(data.subcategories || [], id);
  if (!s) return NEUTRAL;
  return s.color || catColor(data, s.categoryId);
}

// Farbe eines Timeline-Eintrags nach Filter-Zustand — zentrale Prioritätskette.
// Datenmodell (mit IDs statt Klarnamen):
//   entry.categoryId        — Kategorie (Klarname-Äquivalent: entry.category)
//   entry.subcategoryIds[]  — nach Priorität; [0] = primär (Äquiv.: entry.subcategories)
//   activeFilters.categories/.subcategories — aktive Filter-IDs
//   data (categories/subcategories mit .color) = COLOR_MAP-Äquivalent
// Prioritätskette:
//   1. PRIMÄRE Unterkategorie (subcategoryIds[0]) ist aktiver Unterkat.-Filter → deren Farbe
//   2. eine SEKUNDÄRE Unterkategorie (subcategoryIds[1..]) ist aktiv → Farbe der ersten passenden
//   3. Kategorie ist aktiver Kategorie-Filter UND KEIN Unterkat.-Filter aktiv → Kategorie-Farbe
//   4. FALLBACK (keine Filter aktiv / kein Treffer): primäre Unterkategorie-Farbe, sonst Kategorie
export function getEntryColor(entry, activeFilters, data) {
  const subs = entry.subcategoryIds || [];
  const activeSubs = (activeFilters && activeFilters.subcategories) || [];
  const activeCats = (activeFilters && activeFilters.categories) || [];
  const primary = subs[0];

  // 1. PRIMARY SUBCATEGORY ACTIVE
  if (primary && activeSubs.includes(primary)) return subcatColor(data, primary);

  // 2. SECONDARY SUBCATEGORY ACTIVE
  for (let i = 1; i < subs.length; i++) {
    if (activeSubs.includes(subs[i])) return subcatColor(data, subs[i]);
  }

  // 3. MAIN CATEGORY ACTIVE (nur wenn kein Unterkategorie-Filter aktiv)
  if (activeSubs.length === 0 && entry.categoryId && activeCats.includes(entry.categoryId)) {
    return catColor(data, entry.categoryId);
  }

  // 4. FALLBACK
  if (primary) return subcatColor(data, primary);
  return catColor(data, entry.categoryId);
}

// Teil-Datum → JS-Date. `s` ist "YYYY" | "YYYY-MM" | "YYYY-MM-DD".
// edge='start' → Periodenanfang, edge='end' → Periodenende.
export function toDate(s, edge = 'start') {
  if (!s) return null;
  if (s === 'now') return new Date();          // „läuft bis heute"
  const p = String(s).split('-').map(Number);
  const y = p[0];
  if (!p.length || isNaN(y)) return null;
  if (p.length === 1) return edge === 'end' ? new Date(y, 11, 31) : new Date(y, 0, 1);
  const m = (p[1] || 1) - 1;
  if (p.length === 2) return edge === 'end' ? new Date(y, m + 1, 0) : new Date(y, m, 1);
  return new Date(y, m, p[2]);
}

// Anzeige eines Teil-Datums je nach Genauigkeit (Jahr / Monat Jahr / voll).
const MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
export function fmtDate(s) {
  if (!s) return '?';
  if (s === 'now') return 'heute';
  const p = String(s).split('-').map(Number);
  if (p.length === 1) return String(p[0]);
  if (p.length === 2) return `${MONTHS[(p[1] || 1) - 1]} ${p[0]}`;
  return `${p[2]}. ${MONTHS[(p[1] || 1) - 1]} ${p[0]}`;
}

// Personen platzsparend in Zeilen ("lanes") packen: nicht überlappende
// Lebensspannen teilen sich eine Zeile (Greedy First-Fit nach Startdatum).
// → { personId: laneIndex }, laneCount.
export function assignLanes(personList) {
  const sorted = [...personList].sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const laneEnds = [];
  const map = {};
  for (const p of sorted) {
    const start = +toDate(p.start, 'start');
    const end = +toDate(p.end || p.start, 'end');
    let lane = laneEnds.findIndex((e) => e < start);
    if (lane === -1) { laneEnds.push(end); lane = laneEnds.length - 1; }
    else laneEnds[lane] = end;
    map[p.id] = lane;
  }
  return { map, count: laneEnds.length };
}

// Lesbare Textfarbe (hell/dunkel) je nach Hintergrund-Helligkeit.
export function readableText(hex) {
  const c = hexToRgb(hex);
  if (!c) return '#1f2937';
  const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return lum > 0.62 ? '#1f2937' : '#ffffff';
}
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  return c ? `rgba(${c.r},${c.g},${c.b},${alpha})` : hex;
}

// --- Seed-Daten ----------------------------------------------------------
export function seedData() {
  const data = emptyData();

  const cSci = makeCategory({ name: 'Wissenschaft', color: '#6366f1' });
  const cPol = makeCategory({ name: 'Politik', color: '#ef4444' });
  const cArt = makeCategory({ name: 'Kunst', color: '#f59e0b' });
  const cNat = makeCategory({ name: 'Natur', color: '#10b981' });
  const cSoc = makeCategory({ name: 'Gesellschaft', color: '#8b5cf6' });
  data.categories = [cSci, cPol, cArt, cNat, cSoc];

  const subPhysik = makeSubcategory({ name: 'Physik', categoryId: cSci.id });
  const subMathe = makeSubcategory({ name: 'Mathematik', categoryId: cSci.id });
  const subKrieg = makeSubcategory({ name: 'Krieg', categoryId: cPol.id });
  const subRegierung = makeSubcategory({ name: 'Regierung', categoryId: cPol.id });
  data.subcategories = [subPhysik, subMathe, subKrieg, subRegierung];

  const srcEinstein = makeSource({ title: 'Einstein. Sein Leben und seine Welt', author: 'Walter Isaacson', page: 'Kap. 1–12', kind: 'Buch', publisher: 'Bertelsmann', year: '2009', isbn: '978-3570101032' });
  const srcBoltz = makeSource({ title: 'Ludwig Boltzmann – The Man Who Trusted Atoms', author: 'Carlo Cercignani', kind: 'Buch', publisher: 'Oxford University Press', year: '1998' });
  const srcNewton = makeSource({ title: 'Isaac Newton', author: 'James Gleick', kind: 'Buch', publisher: 'Vintage', year: '2004' });
  data.sources = [srcEinstein, srcBoltz, srcNewton];

  // Personen (order = vertikale Reihenfolge, hier nach Geburt)
  const newton = makeItem({ kind: 'person', title: 'Isaac Newton', start: '1643-01-04', end: '1727-03-31', categoryId: cSci.id, order: 1, sourceId: srcNewton.id, description: 'Begründer der klassischen Mechanik.' });
  const boltzmann = makeItem({ kind: 'person', title: 'Ludwig Boltzmann', start: '1844-02-20', end: '1906-09-05', categoryId: cSci.id, order: 2, sourceId: srcBoltz.id, description: 'Begründer der statistischen Mechanik.' });
  const einstein = makeItem({ kind: 'person', title: 'Albert Einstein', start: '1879-03-14', end: '1955-04-18', categoryId: cSci.id, order: 3, sourceId: srcEinstein.id, description: 'Begründer der Relativitätstheorie.' });
  const roosevelt = makeItem({ kind: 'person', title: 'Franklin D. Roosevelt', start: '1882-01-30', end: '1945-04-12', categoryId: cPol.id, order: 4, description: '32. Präsident der USA.' });

  // Startzustand: Personen platzsparend in Zeilen packen
  const { map: laneMap } = assignLanes([newton, boltzmann, einstein, roosevelt]);
  [newton, boltzmann, einstein, roosevelt].forEach((p) => { p.lane = laneMap[p.id]; });

  // Personen-Ereignisse
  const principia = makeItem({ kind: 'event', title: 'Principia Mathematica', start: '1687-07-05', categoryId: cSci.id, subcategoryIds: [subMathe.id, subPhysik.id], personId: newton.id, sourceId: srcNewton.id, description: 'Bewegungsgesetze und Gravitationsgesetz.' });
  const opticks = makeItem({ kind: 'event', title: 'Opticks', start: '1704-01-01', categoryId: cSci.id, subcategoryId: subPhysik.id, personId: newton.id, sourceId: srcNewton.id, description: 'Theorie des Lichts und der Farben.' });

  const hTheorem = makeItem({ kind: 'event', title: 'H-Theorem', start: '1872-06-01', categoryId: cSci.id, subcategoryId: subPhysik.id, personId: boltzmann.id, sourceId: srcBoltz.id, description: 'Statistische Begründung des 2. Hauptsatzes.' });
  const statMech = makeItem({ kind: 'event', title: 'Statistische Mechanik (S = k·log W)', start: '1877-06-01', categoryId: cSci.id, subcategoryId: subPhysik.id, personId: boltzmann.id, sourceId: srcBoltz.id, description: 'Entropie als Maß der Wahrscheinlichkeit.' });

  const annus = makeItem({ kind: 'event', title: 'Annus Mirabilis', start: '1905-06-30', categoryId: cSci.id, subcategoryId: subPhysik.id, personId: einstein.id, sourceId: srcEinstein.id, description: 'Lichtquanten, Brownsche Bewegung, spez. Relativität, E=mc².' });
  const art = makeItem({ kind: 'event', title: 'Allg. Relativitätstheorie', start: '1915-11-25', categoryId: cSci.id, subcategoryId: subPhysik.id, personId: einstein.id, sourceId: srcEinstein.id, description: 'Feldgleichungen der Gravitation.' });
  const nobel = makeItem({ kind: 'event', title: 'Nobelpreis', start: '1921-12-10', categoryId: cSci.id, subcategoryId: subPhysik.id, personId: einstein.id, sourceId: srcEinstein.id, description: 'Für den photoelektrischen Effekt.' });
  const emig = makeItem({ kind: 'event', title: 'Emigration USA', start: '1933-10-17', categoryId: cPol.id, personId: einstein.id, sourceId: srcEinstein.id, description: 'Flucht vor dem Nationalsozialismus.' });
  const brief = makeItem({ kind: 'event', title: 'Brief an Roosevelt', start: '1939-08-02', categoryId: cPol.id, personId: einstein.id, sourceId: srcEinstein.id, description: 'Warnung vor deutschen Atomwaffen.' });

  const presidency = makeItem({ kind: 'event', title: 'US-Präsidentschaft', start: '1933-03-04', end: '1945-04-12', categoryId: cPol.id, subcategoryId: subRegierung.id, personId: roosevelt.id, description: 'Vier Amtszeiten.' });
  const newdeal = makeItem({ kind: 'event', title: 'New Deal', start: '1933-05-01', categoryId: cPol.id, subcategoryId: subRegierung.id, personId: roosevelt.id, description: 'Reformprogramm gegen die Weltwirtschaftskrise.' });

  // Welt-Ereignisse (Feld „Ereignisse")
  const wwi = makeItem({ kind: 'event', title: '1. Weltkrieg', start: '1914-07-28', end: '1918-11-11', categoryId: cPol.id, subcategoryId: subKrieg.id, description: '' });
  const flu = makeItem({ kind: 'event', title: 'Spanische Grippe', start: '1918-01-01', end: '1920-12-31', categoryId: cNat.id, description: 'Weltweite Influenza-Pandemie.' });
  const ns = makeItem({ kind: 'event', title: 'NS-Herrschaft', start: '1933-01-30', end: '1945-05-08', categoryId: cPol.id, description: '' });
  const wwii = makeItem({ kind: 'event', title: '2. Weltkrieg', start: '1939-09-01', end: '1945-09-02', categoryId: cPol.id, subcategoryId: subKrieg.id, description: '' });

  // Sub-Ereignisse UNTER einem Welt-Ereignis (Ereignis als Container, wie Personen)
  const dday = makeItem({ kind: 'event', title: 'D-Day', start: '1944-06-06', categoryId: cPol.id, subcategoryIds: [subKrieg.id], personId: wwii.id, description: 'Landung in der Normandie.' });
  const vetag = makeItem({ kind: 'event', title: 'Kriegsende Europa', start: '1945-05-08', categoryId: cPol.id, subcategoryIds: [subKrieg.id], personId: wwii.id, description: 'Kapitulation der Wehrmacht.' });

  // Welt-Ereignisse (oberste Ebene) in eigene Zeilen packen (wie Personen)
  const worldEv = [wwi, flu, ns, wwii];
  const { map: eLaneMap } = assignLanes(worldEv);
  worldEv.forEach((e) => { e.lane = eLaneMap[e.id]; });

  data.items = [newton, boltzmann, einstein, roosevelt, principia, opticks, hTheorem, statMech, annus, art, nobel, emig, brief, presidency, newdeal, wwi, flu, ns, wwii, dday, vetag];

  data.connections = [
    makeConnection({ fromId: principia.id, toId: art.id, relation: 'Grundlage für', label: 'Gravitation' }),
    makeConnection({ fromId: statMech.id, toId: annus.id, relation: 'beeinflusst', label: 'Brownsche Bewegung' }),
    makeConnection({ fromId: annus.id, toId: art.id, relation: 'führt zu' }),
    makeConnection({ fromId: annus.id, toId: nobel.id, relation: 'trägt bei' }),
    makeConnection({ fromId: ns.id, toId: emig.id, relation: 'verursacht', label: 'Flucht' }),
    makeConnection({ fromId: brief.id, toId: roosevelt.id, relation: 'gerichtet an' }),
  ];

  data.meta.updated = new Date().toISOString();
  return data;
}
