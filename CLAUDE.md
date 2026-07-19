# PKM-Tool — Zeitleiste für Buchnotizen

Statische Web-App (Vanilla JS, ES-Module), die Notizen aus Büchern auf einer Zeitleiste
visualisiert. Teil einer größeren Homepage (Buchblog + Statistik-Tool, vgl.
`../Vorlesung Statistik`). Kein Build-Schritt, kein Backend — läuft über einen einfachen
statischen Webserver und ist für GitHub-Pages-Stil-Deployment gedacht.

## Architektur

- **Timeline:** [vis-timeline](https://visjs.github.io/vis-timeline/) via CDN (global `vis`),
  Version in `index.html` gepinnt (7.7.3).
- **Module** (ES-`import`, kein Bundler):
  - `js/store.js` — `Store`-Schnittstelle (`async load()/save()`), `LocalStorageStore`,
    `exportJson`/`importJson`. **Einziger** Ort, der `localStorage` kennt (Key `pkm-timeline-v3`).
    Drop-in-Punkt für eine echte DB (Supabase): neue Klasse mit gleicher Schnittstelle, in
    `main.js` tauschen.
  - `js/model.js` — Datenmodell, Factories (`makeItem/Category/Subcategory/Source/Connection`),
    `nextId`, `CATEGORY_PALETTE`, `SOURCE_KINDS`, Farb-/Kontrast-Helfer (`getEntryColor`
    (Prioritätskette, s. u.), `itemColor` (nur Basis-/Kategorie-Farbe, im Detailpanel),
    `catColor/catName`, `subcatsOf/subcatName/subcatColor`, `readableText`, `rgba`), Quellen-Helfer
    (`authorName`, `sourceLabel` = „Nachname, Vorname – Titel", `sortedSources`), Datums-Helfer
    (`toDate(s,edge)` Teil-Datum→Date, `fmtDate`), `persons/worldEvents/eventsOf`,
    `assignLanes()` (Start-Packing), `seedData()`.
  - `js/timeline.js` — `TimelineView`: **zwei Render-Modi** (opt.`groupBy`, s. GroupBar / C5).
    **Standard (`kind`, `_renderKindMode`):** oben **Welt-Ereignis-Zeilen** (Gruppen `elane_<v>`,
    Klasse `grp-events`, negativer `order`), darunter **Personen-Zeilen** (`lane_<v>`,
    `grp-lane`); Items per Maus vertikal ziehbar (Gap-Drag). **Sektioniert (`category`/`land`,
    `_renderSectionedMode`):** eine Sektion je Kategorie-/Land-Wert (Reihenfolge/Sichtbarkeit aus
    `data.meta.groupOrder/groupHidden`, Gruppen-IDs `s<key>_lane_<v>`/`s<key>_elane_<v>`,
    `order`-Band `secIdx*200000`), je Sektion weiter die zwei Unterblöcke Ereignisse/Personen;
    Item-Drag hier deaktiviert (Umsortieren über GroupBar-▲▼). Beide gruppieren nach dem
    `lane`-Feld des Items (gleiche `lane` = gleiche Zeile);
    Start-Werte via `assignLanes()`. Person-Lebensspanne = `range`
    (auswählbar, `id-<personId>`), Ereignisse = `box`/`range`, Welt-Intervalle zusätzlich als
    ganzhohes `background`-Kontextband. Innerhalb einer Zeile: Lebensbalken (subgroup `life`,
    `sgorder:0`) **oben**, Ereignisse (subgroup `row_<n>`, `sgorder:1+row`) **darunter** —
    Reihenfolge über eine `subgroupOrder`-**Vergleichsfunktion**. Doppelklick auf eine Person =
    ein-/ausklappen, auf ein Ereignis = bearbeiten.
    `align:'center'` → Beschriftung mittig (global); `showCurrentTime:false` (keine rote Jetzt-Linie).
    **Gesten:** `zoomable:false` + eigener Wheel-Handler `_bindWheel()` — Pinch (= ctrl+wheel;
    Safari via `gesture*`-Events) bzw. Cmd/Ctrl+Rad zoomt um den Cursor (klemmt selbst auf
    `zoomMin`/`zoomMax`), `|deltaX|>|deltaY|` pannt horizontal, sonst Event durchlassen →
    `.timeline-wrap` scrollt nativ vertikal. `setWindow` immer mit `{animation:false}`.
    Ereignis-Form über Klasse: `pkm-ev-range` (Start+Ende → eckiger Balken, clean, ohne Endkappen;
    Label gekappt via `max-width:100%` + Ellipsis) bzw. `pkm-ev-point` (nur Start → eckiges
    Kästchen; per-Item `align:'left'` → **linke Kante = Startdatum**). **Kind-Zeitpunkte dürfen den
    Rahmen (= Container-Balken) nie überschreiten:** das Overlay misst den Platz und
    `applyPointAlign` setzt per-Item `align` ('right' → Kasten wächst nach links, rechte Kante =
    Datum) **und** eine Größen-Klasse — `pkm-ev-small` (kleinere Schrift) bzw. `pkm-ev-dot` (nur
    schmale Markierung, Ereignis im Hover-Tooltip). Der Titel steht immer im Tooltip (`_tooltip`).
    Datums-Marker = **SVG-Pfeil** aus connections.js.
    **Personen** sind per Maus vertikal in andere Zeilen ziehbar — **ohne vorherige Selektion**
    (`itemsAlwaysDraggable:{item:true}`; vis verlangt sonst `item.selected` für den Drag-Start)
    (`editable.updateGroup`, `updateTime:false`; Ereignisse `editable:false`); `onMove` →
    `cb.onMovePersonDrag` setzt `person.lane`. Beim Drag-Start blendet `_bindGapDrag()` dünne
    **Einfüge-Zeilen** ein (Gap-Gruppen `gap_<x>`/`egap_<x>`, Klasse `grp-gap`, nur der Bereich
    des gezogenen Items): die ID trägt die Ziel-**Halb-Lane** (z. B. `1.5` = zwischen Zeile 1
    und 2) — Drop dorthin = **neue Zeile** (`handlePersonDrag` setzt den Bruchwert,
    `normalizeLanes` normiert auf ganze Zahlen). Entfernt via render() bzw. pointerup-Fallback.
    WICHTIG: `_bindGapDrag()` hört auf **Pointer-Events** (`pointerdown/-move/-up/-cancel`) —
    vis/Hammer ruft auf `pointerdown` `preventDefault` auf, wodurch die Kompatibilitäts-
    Mausevents (`mousedown`/`mousemove`/`mouseup`) während eines Drags NIE feuern.
    `render(data, visible, { showBands, collapsed })`: `collapsed` = Set von Person-IDs, deren
    Ereignisse ausgeblendet werden; `showBands` schaltet die Kontext-Schattierung.
  - `js/connections.js` — `OverlayLayer`: SVG-Overlay zeichnet (1) einen **Kasten je Container**
    (Kategorie-Farbe): horizontal **exakt so breit wie der Container-Balken** (Lebensbalken bzw.
    Ereignis-Balken, NICHT die Kinder — die werden in den Rahmen gezwungen, s. u.), vertikal eng
    um den gesamten Inhalt (`inset` 3px) → zentriert.
    (2) **Verbindungen** (`conn.type`), abschaltbar über `setData(.., { showConnections })`:
    **„relation"** (`_drawRelation`) = gebogener Bézier von Boxkante zu Boxkante (andauernd);
    **„aktion"** (`_drawAktion`) = **gerade, an einem Datum verankerte** Linie zwischen den
    Zeilen von Quelle/Ziel (x aus `conn.date` bzw. dem Startdatum eines punktuellen
    Endpunkt-Ereignisses, via `_dateToX` = aktuelles Zeitfenster `cb.getWindow()` +
    Breite des `.vis-center`-Panels; Akzentfarbe, Marker `#arrow-aktion`).
    (3) **Datums-Pfeil** je Zeitpunkt-Ereignis (`_drawArrows`, Spitze auf dem Datum, ragt heraus,
    Ereignisfarbe) **und** die **Platz-Messung** (`_computePointLayout`): je Kind-Zeitpunkt wird
    Ausrichtung + Größenstufe bestimmt, sodass es den Rahmen **nie überschreitet** — der Reihe
    nach: normal rechtswachsend (`align:'left'`) → normal linkswachsend (`align:'right'`, rechte
    Kante = Datum) → kleinere Schrift (`pkm-ev-small`) links/rechts → nur Markierung
    (`pkm-ev-dot`, Ereignis im Hover-Tooltip). Die Naturbreiten je Stufe kommen aus einer
    **Canvas-Textmessung** (`_naturalWidth`; Konstanten `MEASURE`/`DOT_W` MÜSSEN zu den
    CSS-Regeln in styles.css passen), nicht aus dem gerenderten Kasten → die Entscheidung ist
    zustands-**unabhängig** (oszillationsfrei) und wird **entprellt außerhalb** des vis-Redraws
    (`_scheduleAlign`, `setTimeout` 120 ms, sonst „infinite loop in redraw") über
    `cb.onPointAlign(map)` → `TimelineView.applyPointAlign` (`itemsDS.update`, per-Item `align`
    + Größen-Klasse) angewandt. Neu bei `changed`/`rangechanged`/`resize`.
  - `js/filters.js` — `FilterBar`: **drei getrennte Popover-Panels** nebeneinander (C8, generisch
    über `_trigger(key,…)`, `openPanel` ∈ {null,'cat','kind','land'}):
    (1) **Kategorien** — Kategorien-**Baum** (Hauptkategorie = Sammel-Checkbox mit „gemischt"-
    Zustand (indeterminate) bei Teilauswahl, darunter eingerückt die Unterkategorien einzeln) +
    **Quelle** als Dropdown (`sourceFilter`). Kategorien OHNE eigene Unterkategorien: die
    Hauptkategorie-Checkbox ist der direkte Filter (`offCats`); MIT Unterkategorien: **nur**
    `offSubs` ist echter Zustand, `offCats` wird nachgeführt (`_syncCatFromSubs`).
    (2) **Typ** — Personen/Ereignisse ein-/ausblenden (`offKinds`, Filter über `it.kind`).
    (3) **Länder** — Einzelauswahl-Radioliste (`landFilter`, nur `landsInUse()`).
    Liefert `visibleIds()` (Sichtbarkeit, `_itemPasses`). Person ausgeblendet → ihre Ereignisse
    auch. Einfärbung ist NICHT vom Filterzustand abhängig (s. u.).
  - `js/groupbar.js` — `GroupBar` (C5): Toolbar-Panel „Gruppieren nach" — Modus-Umschalter
    (`kind`/`category`/`land` → `data.meta.groupBy`) + je Sektion ▲▼ (Reihenfolge →
    `data.meta.groupOrder[mode]`) und 👁 (Ein/Ausblenden → `data.meta.groupHidden[mode]`).
    Sektions-Helfer in `model.js`: `sectionKeyOf`/`sectionLabel`/`sectionKeysInUse`/
    `effectiveSectionOrder`. `onChange` → `render()`+`persist()` in main.js.
  - `js/ui.js` — Modals (Item/Connection/Category/Source) + Detailpanel (Person: Ereignisliste
    + ▲▼-Sortierung). Reine View-Schicht. Im Eintrags-Dialog (`openItemModal`) sind Unterkategorien
    **geordnete Chips** (erste = **primär · Farbe**, per ▲▼ umsortierbar, ✕ entfernt, „＋"-Chips
    fügen hinzu) — `selectedSubIds` als Array (Reihenfolge = `subcategoryIds`) — plus ein
    **Live-Farbfeld**, das `getEntryColor(draft, data)` anzeigt.
  - `js/sourcesview.js` — `SourcesView` (Quellen-Tab, Plan Phase 6): quellenzentrierter
    Arbeitsbereich. Links durchsuchbare Quellenliste (mit Verwendungszähler), rechts zur
    gewählten Quelle: **Notizen** (Markdown-light via `mdLite`), **„Verwendet in"** (Backlinks
    aus `itemsUsingSource`, Klick → Sprung in die Zeitleiste), **„Ereignis binden"** (hängt einem
    bestehenden Eintrag einen `ref` auf diese Quelle an). Metadaten-Bearbeiten öffnet das
    bestehende `openSourceForm`-Modal (jetzt aus `ui.js` exportiert).
  - `js/main.js` — hält `data`, verdrahtet alles, `render()` + `persist()` nach jeder Änderung.
    **View-Router** (`currentView`, `setView`/`wireTabs`): zwei Tabs **Zeitleiste ↔ Quellen**
    blenden `.layout` bzw. `#sources-view` ein/aus (`.timeline-only`-Elemente per
    `body.view-sources` versteckt). Rückwechsel zur Zeitleiste ruft `timelineView.redraw()` +
    `overlay.requestDraw()` (vis misst bei `display:none` falsch).

## Datenmodell

`{ items, categories, subcategories, connections, sources, meta }` (kuratierter
Default-Datensatz: `data/zeitleiste.json`, geladen von `loadDefaultData()` in main.js).

- **categories**: `{id,name,color}` — vom Nutzer verwaltbar (hinzufügen/Farbe ändern/löschen).
  Färbt **sowohl** Personen **als auch** Ereignisse. EINE gemeinsame Liste für beide.
- **categories** haben `color`; **subcategories**: `{id,name,categoryId,color}` — feinere
  Einteilung, **eigene Farbe** optional (`subcatColor()` = eigene Farbe, sonst Kategorie-Farbe);
  im Item via **`subcategoryIds: []`** (Mehrfach!). Alt-Feld `subcategoryId` wird migriert.
- **Container-Konzept:** `personId` ist das **generische Eltern-Feld** — es zeigt auf eine
  **Person ODER ein Ereignis**. `isContainer(item)` = Person oder Ereignis ohne Eltern. Ein
  Container hat eine `lane` und einen **Rahmen** um seine Kind-Ereignisse (`eventsOf(id)`).
- **`land`** (optional, jedes Item): Ort einer Person/eines Ereignisses, EIN Wert aus der festen
  Liste `COUNTRIES` (`model.js`, ~150 Länder inkl. einiger historischer Staaten wie „Preußen",
  „Sowjetunion", „Osmanisches Reich") oder `null`. Auswahl im Eintrags-Dialog (`ui.js`,
  einfaches Dropdown, keine Selbstverwaltung wie bei Quellen), Anzeige im Detailpanel. Eigenes
  Filter-Dropdown in der Filterleiste (`landsInUse()` — nur tatsächlich verwendete Länder,
  Einzelauswahl wie Quelle), bewusst **getrennt** vom Kategorien-Baum-Panel (C3) und mit
  **direktem** Feldvergleich (kein Kaskadieren zu Kind-/Eltern-Items wie bei Quellen). Mehrfach-
  Länder pro Eintrag (Umzug etc.) bewusst NICHT in v1 — siehe Backlog D1.
- **items**, unterschieden über `kind`:
  - **person** — Lebensspanne (`start`+`end`), `categoryId`, **`lane`** (Startwert via
    `assignLanes()`); Personen mit gleicher `lane` teilen sich eine Zeile (unterer Bereich).
  - **event** — `start`, optional `end`, `categoryId`, optional `subcategoryIds[]`.
    `personId` leer → **oberste Ebene** („Ereignisse"-Feld) mit eigenem **`lane`** (gepackt +
    ziehbar). `personId` gesetzt → **Kind** dieses Containers, erscheint mit **`row`** =
    Unterzeile im Rahmen des Elternteils (Person oder Ereignis).
  - **Form je Ereignis:** `end` gesetzt = Zeitraum (`pkm-ev-range`, eckiger Balken, ohne Endkappen);
    ohne `end` = Zeitpunkt (`pkm-ev-point`, eckiges Kästchen, **linke Kante = Startdatum** via
    per-Item `align:'left'`; bei Platznot im Rahmen stuft das Overlay ab: andere Seite →
    kleinere Schrift → nur Markierung mit Hover-Tooltip. Datums-Marker = SVG-Pfeil aus
    connections.js).
  - **Datumsfelder** (`start`/`end`) sind **Teil-Daten**: `"YYYY"` | `"YYYY-MM"` | `"YYYY-MM-DD"`.
    Jahr ist Pflicht, Monat/Tag optional. `end` kann außerdem `"now"` sein („läuft bis heute").
    Für vis via `toDate()` (Start=Periodenanfang, Ende=Periodenende, `"now"`=aktuelles Datum),
    Anzeige via `fmtDate()` (`"now"`→„heute").
- **source**: `{id,title,authorFirst,authorLast,kind,year,page,publisher,isbn,journal,doi,
  volume,issue,url,accessed}`. `kind` ∈ `SOURCE_KINDS`; der Quellen-Dialog zeigt **kontextuelle**
  Felder je `kind` (Buch→Verlag/ISBN, Paper→Journal/DOI/Vol/Issue, Webseite→URL/abgerufen …).
  Alt-Feld `author` wird in `makeSource` auf Vor-/Nachname migriert. `sourceId` verknüpft Items.

**Farbe der Timeline-Einträge** zentral über `getEntryColor(entry, data)` — bewusst **unabhängig
vom Filterzustand** (Textkontrast weiterhin über `readableText()`): primäre Unterkategorie
(`subcategoryIds[0]`) → deren Farbe (`subcatColor`), sonst Kategorie-Farbe (`catColor`). Jede
Unterkategorie hat einen **festen** Farbton: eigene Farbe falls gesetzt, sonst automatisch ein
Schattierungs-Ton aus der Farbfamilie der Oberkategorie (`autoSubcatColor` in `model.js`,
Helligkeit variiert nach Position unter den Geschwister-Unterkategorien) — ändert sich **nie**
durchs Filtern/Ausblenden von Kategorien (früher ein Bug: Farbe hing vom global aktiven
Filter-Set ab, unbeteiligte Items färbten sich beim Umschalten fremder Kategorien um).
Angewendet in `timeline.js` (Lebensbalken + Ereignisse) und `connections.js` (Rahmenfarbe).
`itemColor(item,data)` (reine Kategorie-Farbe, ignoriert Unterkategorie) bleibt nur noch als
Sonderfall im **Detailpanel** (`ui.js`).

## Konventionen & Stolperfallen

- **Look-&-Feel-Roadmap (P1–P6, 2026-07):** Overlay-Redraw gebündelt per `requestDraw()`
  (rAF, `connections.js`); **vertikaler Zoom** via CSS-Var `--vzoom` (skaliert NUR vertikale
  Item-Paddings — Font/horizontal bleibt wegen der `pkm-ev-point`-Messung; `TimelineView._setVZoom`,
  Alt/⌥+Rad + ⇕-Buttons); **Sektions-Sortierkriterium** `data.meta.groupSort[mode]`
  (`effectiveSectionOrder`/`sectionComparator`); **Micro-Motion** über `--dur-*`/`--ease` +
  `prefers-reduced-motion`; **Detailleiste einklappbar** (`body.detail-collapsed`, Griff
  `#btn-detail-toggle`, Shortcut `d`, Zustand in `localStorage`); **Quellen-Tab** (View-Router,
  `sourcesview.js`). Shortcuts gesamt: `n` neuer Eintrag · `f` einpassen · `/` Suche · `d`
  Detailleiste · Cmd/Ctrl+Z Undo.
- **Flexbox-`min-width`-Falle:** ein Flex-Item mit `width:0` schrumpft NICHT auf 0, solange
  `min-width:auto` (= Inhaltsbreite) gilt → beim Einklappen der Detailleiste zusätzlich `min-width:0`.
- **`[hidden]` vs. `display`:** `.layout`/`.sources-layout` haben `display:flex`, das das
  `hidden`-Attribut überschreibt → explizite Regel `.layout[hidden]{display:none}` nötig (View-Router).
- **Design „Bronze & Papier"** (Referenz: `design_handoff_zeitleiste/`): alle Farbtokens als
  oklch-Werte in `css/styles.css` (`--accent`, `--accent-soft`, `--accent-ink`, `--surface(-2)`,
  `--line`, `--ink(-soft)`, `--muted` …), Radius bewusst fast eckig (`--radius: 1px` überall),
  Schriften **Source Serif 4** (Brand-Titel, Detail-`h2`, Modal-`h3`, `--font-serif`) +
  **Manrope** (Rest, `--font`) via Google Fonts in `index.html`. Übergänge jetzt **dezente
  Micro-Motion** (P4, `--dur-*`/`--ease`; früher bewusst instant). Die Rail-Labels „◆ Ereignisse" / „● Personen" sind **gedrehte
  vis-Gruppenlabels** (`writing-mode:vertical-rl` + `rotate(180deg)` auf `.grp-events`/`.grp-lane
  .vis-inner`; Text nur in der jeweils ersten Zeile, `overflow:visible` nötig).
- **⚠️ NIE `position` auf `.vis-item` setzen!** vis positioniert Items mit `position:absolute`
  + `transform`. Ein `position:relative`-Override (z. B. als Anker für ein `::after`) reißt die
  Items aus dem absoluten Layout → sie fließen horizontal nacheinander (jedes weitere wird nach
  rechts geschoben, Bänder passen nicht mehr zu Balken). Pseudo-Elemente (`::after`) ankern auch
  ohne eigenes `position:relative` am Item (es ist ja schon absolut positioniert).
- **Messen erst nach Animation:** `fit()` animiert ~500 ms. Positions-Checks per
  `getBoundingClientRect` brauchen ~2–3 s Wartezeit, sonst misst man Zwischenframes.
- **⚠️ vis-Stacking ist AUS (`stack:false`):** vis stapelte Lebensbalken derselben Zeile schon
  bei **Pixel-Nähe** (`margin.item.horizontal` zählt als Kollision) und mit Konvergenz-Fehlern
  (Subgruppen-Offsets blieben auf veralteten Höhen hängen) → leere Zwischenzeile zwischen Name
  und Ereignis, Rahmen unnötig hoch. Der `nostack`-Pfad ist deterministisch: jede Subgruppe
  (`life`, `row_<n>`) ist genau **eine** Ebene. Überlappungsfreiheit ist deshalb **Datenfrage**
  (zeitbasiert): Zeilen via `fitLane`/`laneClash`/`enforceLaneIntegrity`, Unterzeilen via
  `fitRow` (neue Kind-Ereignisse bzw. Container-Wechsel → erste freie Unterzeile). Zwei
  Einträge, die sich NUR pixelweise überlappen (z. B. Box-Labels weit herausgezoomt), zeichnet
  vis übereinander — Nutzer sortiert per Drag bzw. ▲▼ um.
- **Zeilen ("lanes"):** `item.lane` bestimmt die Zeile — für **Personen** (Bereich unten,
  `lane_<v>`) UND **Welt-Ereignisse** (Bereich oben, `elane_<v>`), getrennte Namespaces.
  Startwert via `assignLanes()`; danach **manuell** per Maus-Drag (`handlePersonDrag` parst
  `lane_`/`elane_` sowie die Einfüge-Zeilen `gap_`/`egap_` mit Halb-Lane-Wert → neue Zeile
  zwischen zwei bestehenden) oder ▲/▼ im Detailpanel (`movePerson` nutzt `laneSiblings` →
  `normalizeLanes(list)`). Neue Einträge via `fitLane()`. Personen-Ereignisse: `event.row`
  (▲/▼ → `moveEvent`); neue Kind-Ereignisse via `fitRow()` in die erste freie Unterzeile.
  `__events` (`order:-1e9`) bleibt oben. Überlappen sich Personen in einer Zeile, stapelt vis sie.
- **Browser-Cache / `serve.py`:** `python3 -m http.server` lässt ES-Module aggressiv cachen →
  Änderungen wirken erst nach hartem Reload. `serve.py` schickt `Cache-Control: no-store`
  (empfohlener Dev-Server). Modul-Imports tragen einmalig `?v=20`, um alten Cache zu umgehen;
  bei größeren Umbauten ggf. erhöhen (mit `serve.py` aber nicht nötig).
- **Keine Zeit-Drags:** `editable:false`. Datum/Fachliches ausschließlich über den Bearbeiten-Dialog.
- **Item↔DOM-Verknüpfung:** jedes vis-Item hat Klasse `id-<itemId>`; Person ist über ihren
  Lebensbalken (`id-<personId>`) auswähl-/verknüpfbar. Welt-Kontextbänder haben `id`-Präfix
  `band_` → `realId()` strippt es in `main.js`.
- **WICHTIG – box-Items haben 3 DOM-Elemente:** vis legt die Klasse `id-<id>` bei `type:'box'`
  auch auf den Achsen-Punkt (`.vis-dot`) und die Linie (`.vis-line`). Anker/Maße daher immer mit
  `.vis-item.id-<id>:not(.vis-dot):not(.vis-line)` holen (sonst landet alles oben an der Achse).
  Die Achsen-Punkte/-Linien sind per CSS ausgeblendet (`.vis-dot,.vis-line{display:none}`).
- **Personennamen** stehen im Lebensbalken (Item-Content), links nur ein Farb-Punkt als Ziehgriff.
  vis filtert HTML in Item-Content (class/style werden entfernt) → dort keine eigenen Klassen
  stylen, sondern Klartext/Trennzeichen verwenden.
- **Subgroup-Reihenfolge:** die Feldname-Form (`subgroupOrder:'sgorder'`) hat bei uns NICHT
  sortiert; zuverlässig ist die **Vergleichsfunktion** `(a,b)=>a.sgorder-b.sgorder`. Damit liegt
  der Lebensbalken oben, die Ereignisse darunter.
- **Rahmen = Balkenbreite, Kinder im Rahmen:** der Rahmen ist horizontal exakt so breit wie der
  **Container-Balken** (Lebensbalken/Ereignis-Balken), vertikal eng um alle Item-Rects (kleiner
  `inset`) statt an die ganze Zeile geklemmt → zentriert. Kind-Zeitpunkte werden per Layout-Stufen
  (`_computePointLayout`, s. o.) in den Rahmen gezwungen — nur wenn das **Datum selbst** außerhalb
  der Container-Zeit liegt, ragt die Mini-Markierung heraus (Datenfrage, kein Layout-Bug). Da vis
  überlappende Einträge stapelt, liegen die Rects verschiedener Zeilen ohnehin vertikal getrennt
  → keine Rahmen-Überlappung.
- **Ereignis-Formen (eckig):** Zeitpunkt = `pkm-ev-point` (`border-radius:1px`, per-Item
  `align:'left'` → linke Kante = Startdatum; bei Platznot Stufen `align:'right'` /
  `pkm-ev-small` (10px Schrift, max-width 130px) / `pkm-ev-dot` (6px-Markierung, Text versteckt,
  Ereignis im Tooltip) — **die CSS-Werte dieser Klassen MÜSSEN zu `MEASURE`/`DOT_W` in
  connections.js passen**, sonst stimmt die Platz-Messung nicht mehr (Normalstufe seit dem
  Redesign: 11px Schrift, padX 18, max-width 150px); Datums-Marker ist ein
  **SVG-Pfeil im Overlay** (`_drawArrows`, `.pkm-ev-marker`), **kein** CSS-Pseudo-Element mehr;
  lange Labels **verlängern den Kasten nicht**, sondern werden gekappt —
  `.pkm-ev-point .vis-item-content { max-width:150px; overflow:hidden; text-overflow:ellipsis }`
  (Volltext im Tooltip, analog zu den Personen-Balken)), Zeitraum = `pkm-ev-range`
  (`border-radius:1px`, **ohne** weiße Endkappen — clean; Beschriftung mittig via globalem
  `align:'center'`; Label gekappt auf `max-width:100%`, ragt nicht über den Balken).
  Oberste Ebene (Welt-Ereignis/Container) trägt zusätzlich `pkm-top` → größerer Chip
  (12.5px/700); Kind-Ereignisse bleiben 11px/600 (nur die werden vom Overlay vermessen).
  WICHTIG: an `.vis-item.pkm-event` **kein** `position:relative`/`transform`-Override (vis
  positioniert per `transform: translate` — Umklappen daher über vis-`align`, nicht per CSS).
- **Overlay-Größe:** SVG hat ohne explizite Größe nur 300×150; `draw()` setzt jedes Mal
  `style.width/height` auf `tlContainer.offset*`, sonst werden Pfeile abgeschnitten.
- **Overlay:** `.conn-overlay` ist `pointer-events:none`, nur die Pfade `pointer-events:stroke`.
- vis-`title` (Tooltip) wird als Plaintext gesetzt (XSS-Filter); HTML dort vermeiden.
- **Gruppen-Klassen:** Zeilen tragen `grp-lane`, das Feld oben `grp-events` → unterschiedliches
  CSS (Personennamen stehen im Balken, „Ereignisse" als Kaps-Label links).
- **Storage-Key versioniert** (`-v6`): bei inkompatiblen Modell-Änderungen Key erhöhen.

## Dev-Workflow

```bash
cd PKM-Tool
python3 serve.py 8090         # empfohlen (kein Cache) → http://localhost:8090
# oder: python3 -m http.server 8090   (dann hart neu laden, ES-Module brauchen http://)
```

Kein Build, kein Test-Runner. Änderungen wirken nach Reload. localStorage-Key: `pkm-timeline-v6`
(zum Zurücksetzen im Browser löschen).
