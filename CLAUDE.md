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
  - `js/timeline.js` — `TimelineView`: oben **Welt-Ereignis-Zeilen** (Gruppen `elane_<v>`,
    Klasse `grp-events`, negativer `order`), darunter **Personen-Zeilen** (`lane_<v>`,
    `grp-lane`). Beide gruppieren nach dem `lane`-Feld des Items (gleiche `lane` = gleiche Zeile);
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
    **Personen** sind per Maus vertikal in andere Zeilen ziehbar
    (`editable.updateGroup`, `updateTime:false`; Ereignisse `editable:false`); `onMove` →
    `cb.onMovePersonDrag` setzt `person.lane`. Beim Drag-Start blendet `_bindGapDrag()` dünne
    **Einfüge-Zeilen** ein (Gap-Gruppen `gap_<x>`/`egap_<x>`, Klasse `grp-gap`, nur der Bereich
    des gezogenen Items): die ID trägt die Ziel-**Halb-Lane** (z. B. `1.5` = zwischen Zeile 1
    und 2) — Drop dorthin = **neue Zeile** (`handlePersonDrag` setzt den Bruchwert,
    `normalizeLanes` normiert auf ganze Zahlen). Entfernt via render() bzw. mouseup-Fallback.
    `render(data, visible, { showBands, collapsed })`: `collapsed` = Set von Person-IDs, deren
    Ereignisse ausgeblendet werden; `showBands` schaltet die Kontext-Schattierung.
  - `js/connections.js` — `OverlayLayer`: SVG-Overlay zeichnet (1) einen **Kasten je Container**
    (Kategorie-Farbe): horizontal **exakt so breit wie der Container-Balken** (Lebensbalken bzw.
    Ereignis-Balken, NICHT die Kinder — die werden in den Rahmen gezwungen, s. u.), vertikal eng
    um den gesamten Inhalt (`inset` 3px) → zentriert.
    (2) **Verbindungspfeile** direkt von Kästchen zu Kästchen (Seiten-Anker + Bézier),
    abschaltbar über `setData(.., { showConnections })`.
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
  - `js/filters.js` — `FilterBar`: **Kategorie** + **Unterkategorie** als Chips (ausblenden),
    **Quelle** als **Dropdown** (`sourceFilter`, einzeln, sortiert nach Nachname). Liefert
    `visibleIds()` (Sichtbarkeit) **und** `activeFilters()` = `{categories, subcategories}` für die
    Einfärbung (`getEntryColor`). Person ausgeblendet → ihre Ereignisse auch.
  - `js/ui.js` — Modals (Item/Connection/Category/Source) + Detailpanel (Person: Ereignisliste
    + ▲▼-Sortierung). Reine View-Schicht. Im Eintrags-Dialog (`openItemModal`) sind Unterkategorien
    **geordnete Chips** (erste = **primär · Farbe**, per ▲▼ umsortierbar, ✕ entfernt, „＋"-Chips
    fügen hinzu) — `selectedSubIds` als Array (Reihenfolge = `subcategoryIds`) — plus ein
    **Live-Farbfeld**, das `getEntryColor(draft, {}, data)` (Standardfarbe ohne Filter) anzeigt.
  - `js/main.js` — hält `data`, verdrahtet alles, `render()` + `persist()` nach jeder Änderung.

## Datenmodell

`{ items, categories, connections, sources, meta }` (siehe `data/sample.json`).

- **categories**: `{id,name,color}` — vom Nutzer verwaltbar (hinzufügen/Farbe ändern/löschen).
  Färbt **sowohl** Personen **als auch** Ereignisse. EINE gemeinsame Liste für beide.
- **categories** haben `color`; **subcategories**: `{id,name,categoryId,color}` — feinere
  Einteilung, **eigene Farbe** optional (`subcatColor()` = eigene Farbe, sonst Kategorie-Farbe);
  im Item via **`subcategoryIds: []`** (Mehrfach!). Alt-Feld `subcategoryId` wird migriert.
- **Container-Konzept:** `personId` ist das **generische Eltern-Feld** — es zeigt auf eine
  **Person ODER ein Ereignis**. `isContainer(item)` = Person oder Ereignis ohne Eltern. Ein
  Container hat eine `lane` und einen **Rahmen** um seine Kind-Ereignisse (`eventsOf(id)`).
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

**Farbe der Timeline-Einträge** zentral über `getEntryColor(entry, activeFilters, data)` — eine
Prioritätskette abhängig vom Filter-Zustand (Textkontrast weiterhin über `readableText()`):
1. **Primäre Unterkategorie aktiv:** `entry.subcategoryIds[0]` ist ein aktiver Unterkategorie-Filter
   → Farbe dieser Unterkategorie (`subcatColor`).
2. **Sekundäre Unterkategorie aktiv:** eine `subcategoryIds[1..n]` ist aktiv → Farbe der ersten
   passenden.
3. **Kategorie aktiv (ohne Unterkategorie-Filter):** `entry.categoryId` ist ein aktiver
   Kategorie-Filter UND es ist **kein** Unterkategorie-Filter aktiv → Kategorie-Farbe (`catColor`).
4. **Fallback** (keine Filter aktiv / kein Treffer): Farbe der primären Unterkategorie, sonst
   Kategorie-Farbe.

`activeFilters` (`{categories, subcategories}` = Listen aktiver IDs) kommt aus
`FilterBar.activeFilters()`. Da unser Filtermodell **opt-out** ist (`offCats`/`offSubs` = versteckt),
gilt eine Dimension als *aktiv*, sobald in ihr etwas ausgeblendet ist; aktiv sind dann die noch
sichtbaren IDs. `data` (Kategorien/Unterkategorien mit `.color`) ist das COLOR_MAP-Äquivalent.
Angewendet in `timeline.js` (Lebensbalken + Ereignisse) und `connections.js` (Rahmenfarbe).
`itemColor(item,data)` (reine Kategorie-Farbe) bleibt nur noch als filter-unabhängige Basisfarbe
im **Detailpanel** (`ui.js`).

## Konventionen & Stolperfallen

- **⚠️ NIE `position` auf `.vis-item` setzen!** vis positioniert Items mit `position:absolute`
  + `transform`. Ein `position:relative`-Override (z. B. als Anker für ein `::after`) reißt die
  Items aus dem absoluten Layout → sie fließen horizontal nacheinander (jedes weitere wird nach
  rechts geschoben, Bänder passen nicht mehr zu Balken). Pseudo-Elemente (`::after`) ankern auch
  ohne eigenes `position:relative` am Item (es ist ja schon absolut positioniert).
- **Messen erst nach Animation:** `fit()` animiert ~500 ms. Positions-Checks per
  `getBoundingClientRect` brauchen ~2–3 s Wartezeit, sonst misst man Zwischenframes.
- **Überlappende Einträge** stapeln vertikal über `subgroupStack:true` (sonst zeichnet vis sie
  übereinander). Bei sehr weit herausgezoomter Ansicht sind Box-Labels zeit-breit → viel Overlap.
- **Zeilen ("lanes"):** `item.lane` bestimmt die Zeile — für **Personen** (Bereich unten,
  `lane_<v>`) UND **Welt-Ereignisse** (Bereich oben, `elane_<v>`), getrennte Namespaces.
  Startwert via `assignLanes()`; danach **manuell** per Maus-Drag (`handlePersonDrag` parst
  `lane_`/`elane_` sowie die Einfüge-Zeilen `gap_`/`egap_` mit Halb-Lane-Wert → neue Zeile
  zwischen zwei bestehenden) oder ▲/▼ im Detailpanel (`movePerson` nutzt `laneSiblings` →
  `normalizeLanes(list)`). Neue Einträge via `fitLane()`. Personen-Ereignisse: `event.row`
  (▲/▼ → `moveEvent`).
  `__events` (`order:-1e9`) bleibt oben. Überlappen sich Personen in einer Zeile, stapelt vis sie.
- **Browser-Cache / `serve.py`:** `python3 -m http.server` lässt ES-Module aggressiv cachen →
  Änderungen wirken erst nach hartem Reload. `serve.py` schickt `Cache-Control: no-store`
  (empfohlener Dev-Server). Modul-Imports tragen einmalig `?v=16`, um alten Cache zu umgehen;
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
- **Ereignis-Formen (eckig):** Zeitpunkt = `pkm-ev-point` (`border-radius:4px`, per-Item
  `align:'left'` → linke Kante = Startdatum; bei Platznot Stufen `align:'right'` /
  `pkm-ev-small` (10px Schrift, max-width 130px) / `pkm-ev-dot` (6px-Markierung, Text versteckt,
  Ereignis im Tooltip) — **die CSS-Werte dieser Klassen MÜSSEN zu `MEASURE`/`DOT_W` in
  connections.js passen**, sonst stimmt die Platz-Messung nicht mehr; Datums-Marker ist ein
  **SVG-Pfeil im Overlay** (`_drawArrows`, `.pkm-ev-marker`), **kein** CSS-Pseudo-Element mehr;
  lange Labels **verlängern den Kasten nicht**, sondern werden gekappt —
  `.pkm-ev-point .vis-item-content { max-width:160px; overflow:hidden; text-overflow:ellipsis }`
  (Volltext im Tooltip, analog zu den Personen-Balken)), Zeitraum = `pkm-ev-range`
  (`border-radius:3px`, **ohne** weiße Endkappen — clean; Beschriftung mittig via globalem
  `align:'center'`; Label gekappt auf `max-width:100%`, ragt nicht über den Balken).
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
