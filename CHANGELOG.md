# Changelog

Entwicklungs-Protokoll der Zeitleiste-App (rekonstruiert aus der Entwicklungs-Session,
neueste Änderungen oben). Datumsangaben grob; die App ist noch in aktiver Entwicklung.

## Redesign „Bronze & Papier" nach Design-Handoff (2026-07-08)
- **Neues visuelles System** gemäß `design_handoff_zeitleiste/README.md` umgesetzt —
  komplettes Re-Theming, keine Funktionsänderungen:
  - oklch-Farbtokens (Papier-Töne, Bronze-Akzent), Radius fast eckig (`--radius: 1px` überall),
    neue Schatten; Übergänge bewusst instant (Transitions entfernt).
  - Schriften: **Source Serif 4** (Brand-Titel, Detail-Titel, Modal-Überschriften) +
    **Manrope** (alles andere) via Google Fonts.
  - Header/Filterleiste mit den Design-Maßen (16px 28px bzw. 12px 28px), Logo-Kachel 36px,
    quadratischer „?"-Button (`.btn-icon`), Chips eckig, aus = Opacity 0.4.
  - Zähler-Format jetzt „N sichtbar / M gesamt".
  - Rail-Labels „◆ Ereignisse" / „● Personen" als **gedrehte** vis-Gruppenlabels in Akzentfarbe.
  - Detailpanel 360px/24px, Leerzustand mit ◷-Glyphe, Zitat-Blockquote in Akzent-Soft (Serif).
  - Ereignis-Chips: Kinder 11px/600 (MEASURE in connections.js synchron angepasst:
    font 11 / padX 18 / maxW 150), oberste Ebene neu mit Klasse `pkm-top` → 12.5px/700;
    Lebensbalken mit voller Kategorie-Kontur und Tinte `oklch(30% 0.02 265)`.
- **Nicht übernommen** (bewusst): die Länder-Gruppierung aus dem Prototyp — das Datenmodell
  hat kein `country`-Feld, und die Gruppierung würde mit dem manuellen Zeilen-Drag
  (`lane`-Konzept) kollidieren. Bei Bedarf als eigenes Feature nachziehen.
- Cache-Buster auf `?v=20`.

## Drag & Drop repariert, Zeilen-Integrität, Tooltip mit Datum (2026-07-05)
- **Drag & Drop funktioniert jetzt wirklich** — drei Ursachen behoben:
  1. vis startet einen Item-Drag nur auf **vorher selektierten** Items → Ziehen ging erst nach
     einem Extra-Klick. Jetzt `itemsAlwaysDraggable: { item: true }` → anfassen und ziehen.
  2. Die Einfüge-Zeilen (`_bindGapDrag`) hörten auf **Maus-Events** — vis/Hammer ruft aber auf
     `pointerdown` `preventDefault` auf, wodurch die Kompatibilitäts-Mausevents während eines
     Drags nie feuern. Umgestellt auf **Pointer-Events** (`pointerdown/-move/-up/-cancel`).
  3. **vis-Stacking abgeschaltet** (`stack:false`): vis stapelte Lebensbalken derselben Zeile
     schon bei Pixel-Nähe (`margin.item.horizontal` zählt als Kollision) und mit
     Konvergenz-Fehlern (Subgruppen-Offsets blieben auf veralteten Höhen hängen) → Personen
     einer Zeile landeten auf zwei Ebenen, mit **leerer Zwischenzeile** zwischen Name und
     Ereignis und unnötig hohem Rahmen. Der `nostack`-Pfad ist deterministisch: jede Subgruppe
     (Lebensbalken / Unterzeile) ist genau eine Ebene.
- **Integrität statt vis-Automatik:** Überlappungsfreiheit ist jetzt komplett zeitbasiert in
  eigener Hand — Zeilen über `fitLane`/`laneClash`/`enforceLaneIntegrity` (wie gehabt), NEU
  `fitRow` in main.js: neue Kind-Ereignisse (und Kinder, deren Eltern-Container wechselt)
  bekommen automatisch die erste freie **Unterzeile** ohne zeitliche Überschneidung.
- **Tooltip:** Ereignis-Tooltips zeigen jetzt zusätzlich das **Datum** (`fmtDate`, bei
  Zeiträumen „Start – Ende", `now` → „heute"); Titel/Container/Beschreibung/Quelle wie gehabt.
- Verifiziert per Headless-Chrome-Test: keine Leer-Zeilen mehr (Abstand Name→Ereignis 10px bei
  4 Personen in einer Zeile), Einfüge-Zeilen erscheinen beim Ziehen, Drop auf Gap = neue Zeile,
  Drop auf Zeile mit Zeit-Clash = automatische Zwischenzeile, Beispieldaten ohne
  Pixel-Überlappungen. Cache-Buster auf `?v=18`.

## Drag & Drop: Einträge zwischen bestehende Zeilen ziehen (2026-07-04)
- Personen und Welt-Ereignisse konnten per Maus bisher nur in **bestehende** Zeilen gezogen
  werden. Jetzt erscheinen beim Drag-Start dünne **Einfüge-Zeilen** (gestrichelte Linie)
  über/zwischen/unter den Zeilen des jeweiligen Bereichs; ein Drop dorthin legt eine **neue
  Zeile** an genau dieser Position an.
- Umsetzung: `_bindGapDrag()` in timeline.js blendet beim Ziehen Gap-Gruppen (`gap_<x>` /
  `egap_<x>`, Klasse `grp-gap`) ein; die ID trägt die Ziel-**Halb-Lane** (z. B. `1.5` = zwischen
  Zeile 1 und 2). `handlePersonDrag` (main.js) setzt `lane` auf diesen Bruchwert,
  `normalizeLanes` macht daraus wieder ganze Zahlen. Nach Drop/Abbruch verschwinden die
  Einfüge-Zeilen (render() bzw. mouseup-Fallback).

## Ereignis-Layout: Ereignisse bleiben im Rahmen, Rahmen = Balkenbreite (2026-07-04)
- **Neue Layout-Regel:** der farbige **Rahmen** eines Containers ist horizontal nur noch so breit
  wie der **Balken** der Person / des Container-Ereignisses selbst (vorher umschloss er auch
  herausragende Kind-Ereignisse); die Kind-Ereignisse dürfen ihn **nie** überschreiten.
- **Layout-Stufen für Kind-Zeitpunkte** (`_computePointLayout` in connections.js): passt das
  Kästchen nicht rechtswachsend an sein Datum, wird der Reihe nach probiert — linkswachsend
  (`align:'right'`), **kleinere Schrift** (`pkm-ev-small`: 10px, engeres Padding, max-width 130px),
  kleinere Schrift linkswachsend, und zuletzt nur eine schmale **Markierung** (`pkm-ev-dot`, 6px),
  deren Ereignis beim **Drüberhovern im Tooltip** erscheint (Titel steht jetzt immer im Tooltip).
- **Oszillationsfrei gemessen:** die Naturbreite je Stufe kommt aus einer **Canvas-Textmessung**
  (`_naturalWidth`, Konstanten `MEASURE`/`DOT_W` müssen zu styles.css passen), nicht aus dem
  gerenderten Kasten → die Entscheidung hängt nicht vom aktuellen Zustand ab; angewandt wie bisher
  entprellt außerhalb des vis-Redraws (`applyPointAlign` setzt per-Item `align` + Größen-Klasse).
- **Zeitraum-Ereignisse:** Label ragt nicht mehr über den Balken (und damit den Rahmen) hinaus —
  gekappt mit Ellipsis (`.pkm-ev-range .vis-item-content { max-width:100% }`), Volltext im Tooltip.
- Cache-Buster auf `?v=16`.

## Trackpad-Gesten: Pinch = Zoom, Zwei-Finger-Wischen = Verschieben (2026-07-04)
- Bisher zoomten **beide** Trackpad-Gesten (vis-Default: jedes vertikale Wheel-Event = Zoom).
  Jetzt macOS-üblich: **Pinch** (Browser melden sie als ctrl+wheel; Safari via `gesture*`-Events)
  bzw. **Cmd/Ctrl+Mausrad** zoomt um den Cursor, **zwei Finger links/rechts** verschiebt das
  Zeitfenster, **hoch/runter** scrollt `.timeline-wrap` nativ (Rad allein zoomt nicht mehr —
  Google-Maps-Konvention).
- Umsetzung: `zoomable:false` + eigener Wheel-Handler `_bindWheel()` in timeline.js
  (`setWindow` mit `animation:false`, `zoomMin`/`zoomMax` werden selbst geklemmt).

## Zeitpunkt-Ereignisse: Überlauf-Umklappen + Pfeil-Marker (2026-07-01)
- **Lange Labels kappen statt Kasten verlängern:** `.pkm-ev-point .vis-item-content` bekommt
  `max-width:160px` + `text-overflow:ellipsis` → das Kästchen bleibt kompakt, der Titel wird
  abgeschnitten (Volltext im Tooltip) — wie bei den Personen-Balken.
- **SVG-Pfeil-Marker:** der schwache CSS-Balken am Zeitpunkt-Ereignis ist weg; connections.js
  zeichnet stattdessen einen kleinen **Pfeil im Overlay** (`_drawArrows`), dessen Spitze exakt auf
  dem Datum sitzt und der etwas heraus­ragt (Ereignisfarbe).
- **Umklappen bei Überlauf der Lebenszeit:** würde ein linksbündiges Kind-Zeitpunkt-Ereignis über
  die rechte Kante der Lebensspanne ragen (und so den Rahmen verlängern), klappt es nach **links**
  (rechte Kante = Datum). connections.js **misst** den Überlauf (`_computePointAlign`), das
  eigentliche Umklappen setzt timeline.js über per-Item `align:'right'` (`applyPointAlign`) — vis
  positioniert per `transform`, ein CSS-Umklappen wäre nicht sicher.
- **Robustheit:** die Umklapp-Entscheidung ist align-**unabhängig** (nur Datum/Breite/Container) →
  **oszillationsfrei**; das Item-Update wird **entprellt außerhalb** des vis-Redraw-Zyklus
  angewandt (`_scheduleAlign`, 120 ms) → kein „infinite loop in redraw". Passt ein Label an einem
  Zoom weder links noch rechts, bleibt es linksbündig (Überlauf akzeptiert).

## Unterkategorie-Chips + Zeitpunkte linksbündig (2026-07-01)
- **Unterkategorie-Auswahl im Eintrags-Dialog neu:** statt Checkboxen jetzt **geordnete Chips**.
  Die **erste** Unterkategorie ist die **primäre** (Badge „primär · Farbe") und bestimmt die Farbe;
  per **▲▼** umsortierbar, **✕** entfernt, „＋"-Chips fügen hinzu. Damit ist z. B. „von Physik auf
  Mathematik umschalten" ein sichtbarer, bewusster Schritt (`selectedSubIds` als geordnetes Array,
  Reihenfolge = `subcategoryIds`, `[0]` = primär).
- **Live-Farbfeld** im Dialog: zeigt sofort die resultierende Timeline-Farbe über die bestehende
  `getEntryColor(draft, {}, data)`-Logik (Standardfarbe ohne aktiven Filter) — macht transparent,
  wenn eine Unterkategorie ohne eigene Farbe die Kategorie-Farbe erbt.
- **Zeitpunkt-Ereignisse linksbündig:** Ereignisse ohne Ende (`pkm-ev-point`) sitzen jetzt mit der
  **linken Kante exakt auf dem Startdatum** (per-Item `align:'left'`, überschreibt globales
  `align:'center'`) statt mittig auf dem Datum. Ein **Kanten-Marker** (`::before` an `left:0`)
  markiert die Datums-Kante; Text linksbündig. Zeiträume/Personen bleiben zentriert.

## Filterabhängige Einfärbung – `getEntryColor()` (2026-07-01)
- **Neue zentrale Farb-Logik** `getEntryColor(entry, activeFilters, data)` in `model.js` ersetzt
  das reine „Kategorie-Farbe"-Prinzip (`itemColor`) bei der Timeline-Einfärbung. Prioritätskette:
  1. primäre Unterkategorie (`subcategoryIds[0]`) ist aktiver Filter → deren Farbe,
  2. sonst erste aktive **sekundäre** Unterkategorie → deren Farbe,
  3. sonst Kategorie ist aktiv **und** kein Unterkategorie-Filter aktiv → Kategorie-Farbe,
  4. Fallback: primäre Unterkategorie-Farbe, sonst Kategorie-Farbe.
- **`FilterBar.activeFilters()`** neu: leitet aus dem opt-out-Modell (`offCats`/`offSubs`) die aktiven
  Kategorie-/Unterkategorie-IDs ab (aktiv = Dimension in Benutzung, ID nicht ausgeblendet).
- **Angewendet** in `timeline.js` (Lebensbalken + Ereignisse) und `connections.js` (Rahmenfarbe);
  durchgereicht über `render()` in `main.js`. `itemColor` bleibt nur noch als filter-unabhängige
  Basisfarbe im Detailpanel (`ui.js`). Sonst keine Logik geändert.

## Clean & bündige Rahmen/Ereignisse (2026-07-01)
- **Rahmen bündig um den Eintrag:** der Personen-/Container-Rahmen (SVG-Overlay) sitzt jetzt
  horizontal **exakt** an den Item-Kanten (kein seitlicher Überstand, `padX` 7 → 0) und vertikal
  **eng** um den Inhalt (kleiner `inset` statt Klemmen an die ganze Zeile) → der Eintrag ist
  im Rahmen **zentriert**.
- **Grauer Trennbalken entfernt:** die dicke graue Trennlinie (`3px #cfd3dc`) über der ersten
  Personen-Zeile ist raus (`grp-people-first`-Regeln + Klasse entfernt) – aufgeräumteres Bild.
- **Weiße Endkappen entfernt:** Zeitraum-Balken (`pkm-ev-range`) haben keine weißen Streifen
  links/rechts mehr (`::before/::after` gelöscht) – clean.

## Zentrale & eckige Darstellung (2026-06-29)
- **Beschriftungen mittig** im Balken/Kästchen (`align: 'center'` statt links) → auch lange
  Zeitraum-Balken (z. B. „Spanische Inquisition") wirken aufgeräumt.
- **Eckigere Formen:** Ereignis-Kästchen, Lebensbalken und Personen-/Ereignis-Rahmen mit
  kleinerem Radius.
- **Rote „Jetzt"-Linie entfernt** (`showCurrentTime: false`) – bei einer historischen Zeitleiste
  nur störender roter Strich.

## Weiter rauszoomen (2026-06-29)
- **`zoomMax`** von ~400 auf ~100.000 Jahre erhöht → deutlich weiteres Rauszoomen möglich
  (für Antike / lange Zeiträume).

## „Läuft bis heute", zentrierte & eckigere Darstellung, weiter rauszoomen (2026-06-29)
- **Enddatum „läuft bis heute":** im Eintrags-Dialog neben Jahr/Monat/Tag eine Option, die das
  Ende bis zur **Gegenwart** laufen lässt (intern Sonderwert `"now"`, Anzeige „heute";
  aktualisiert sich automatisch). Ideal für lebende Personen / laufende Ereignisse.
- **Beschriftungen mittig** in Balken/Kästchen (`align: 'center'`), **eckigere Formen**
  (Zeitpunkt-Kästchen `4px`, Zeitraum `3px`, Lebensbalken `5px`, Rahmen `rx 6`).
- **Deutlich weiteres Rauszoomen** (`zoomMax` ~100.000 Jahre).
- Rote „Jetzt"-Linie von vis-timeline entfernt.

## Ereignisse als Container + Filter/Farb-Verbesserungen (2026-06-29)
- **Ereignisse verhalten sich wie Personen:** ein Ereignis kann **Sub-Ereignisse** enthalten,
  die – wie bei Personen – innerhalb eines **Rahmens** unter dem Ereignis erscheinen
  (Beispiel-Daten: „2. Weltkrieg" mit „D-Day" und „Kriegsende Europa").
- **„Gehört zu"-Dropdown** beim Anlegen: ein Ereignis lässt sich einer **Person ODER einem
  Ereignis** unterordnen. Das Dropdown ist nach **Kategorie gruppiert** (optgroups) und je Gruppe
  **alphabetisch** sortiert (Personen nach Nachname, Ereignisse nach Titel).
- **Unterkategorien einzeln einfärbbar** (eigener Farbwähler je Unterkategorie im 🎨-Manager);
  Farbe wird für die Chips in Filter und Detailpanel genutzt.
- **Bugfix Unterkategorie-Filter:** Ereignisse **ohne** Unterkategorie wurden beim Filtern immer
  angezeigt. Jetzt gilt: sobald Unterkategorien ausgeblendet sind, erscheinen nur Ereignisse mit
  mindestens einer sichtbaren Unterkategorie (Personen bleiben unberührt).
- **Heller Balken** über der ersten Ereignis-Reihe entfernt (Zeilen-Hintergrund transparent).
- **„Personen"-Beschriftung** links (analog zu „Ereignisse") + **dickerer Trennstrich** zwischen
  dem Ereignis-Feld und den Personen.
- **Doppelklick** auf einen Container (Person **oder** Ereignis mit Sub-Ereignissen) klappt ein/aus;
  der „Einklappen"-Button betrifft nun ebenfalls Ereignis-Container.
- Intern: `personId` dient als generisches **Eltern-Feld** (Person oder Ereignis);
  neue Helfer `isContainer`, `parentOf`, `subcatColor`.

## Welt-Ereignisse wie Personen + prägnantere Formen (2026-06-29)
- **Welt-Ereignisse verhalten sich jetzt wie Personen:** eigenes Zeilen-System im Feld
  „Ereignisse", automatisch platzsparend gepackt (nicht überlappend), und **vertikal
  verschiebbar** – per Maus-Drag und über ▲/▼ im Detailpanel (wichtig für viele Ereignisse,
  z. B. während des 2. Weltkriegs).
- **Prägnanterer Unterschied Zeitpunkt vs. Zeitraum:**
  - **Zeitpunkt (Datum):** runde „Marke" mit **Punkt am Startdatum** (links).
  - **Zeitraum (Start–Stop):** eckiger Balken mit **Endkappen** links und rechts.
- Der Marker beim Zeitpunkt sitzt jetzt **links** (am Startdatum) statt rechts.

## Bugfixes (2026-06-29)
- **Ereignisse standen am falschen Datum / Balken passten nicht zu den Schattierungs-Bändern.**
  Ursache: ein `position: relative` auf `.vis-item.pkm-event` (eingeführt für den rechten
  Kanten-Strich via `::after`) hat vis-timelines `position: absolute` überschrieben → die
  Ereignis-Boxen fielen aus dem absoluten Layout und flossen horizontal nacheinander (jede
  weitere nach rechts verschoben), während die Hintergrund-Bänder korrekt blieben. Fix:
  `position`-Override entfernt; das `::after` ankert weiterhin am (ohnehin absolut
  positionierten) Item. Alle Positionen wieder korrekt.

## Backlog „Neu" abgearbeitet (2026-06-29)
- **Ereignis-Kanten:** Ereignis mit Start **und** Ende → beide Seiten eckig; nur Start →
  links eckig, rechts rund + subtiler vertikaler Strich rechts.
- **Quellen-Maske kontextuell** je Art (Buch / Paper / Artikel / Webseite / Sonstiges) mit
  passenden Feldern (Verlag/ISBN bzw. Journal/DOI/Band/Heft bzw. URL/abgerufen …).
- **Autor** mit getrenntem **Vor- und Nachnamen** (Alt-Daten werden migriert).
- **Quellen-Auswahl als Dropdown**, sortiert nach Autor-Nachnamen (Filter + Eintrags-Dialog).
- **Quellen-Anzeige** überall als „Nachname, Vorname – Titel".
- **Datum:** Jahr Pflicht, Monat & Tag optional (Teil-Daten „YYYY" / „YYYY-MM" / „YYYY-MM-DD").

## Manuelles Verschieben & Cache-Server (2026-06-29)
- **Personen per Maus** vertikal in andere Zeilen ziehbar (zusätzlich zu ▲/▼ im Detailpanel).
- **Ereignisse** innerhalb einer Person per ▲/▼ in andere Unterzeile.
- **Doppelklick auf eine Person** klappt deren Ereignisse ein/aus.
- **`serve.py`** ergänzt: lokaler Dev-Server ohne Browser-Cache (löst „Änderungen wirken nicht"-
  Probleme). Modul-Importe mit `?v=`-Cache-Buster.

## Zeilen-Packing, Einklappen, Unterkategorien (2026-06-28)
- **Personen teilen sich Zeilen:** nicht überlappende Lebensspannen landen in derselben Zeile.
- **Ereignisse ein-/ausklappbar** (einzeln je Person oder global per Toolbar).
- **Unterkategorien** je Kategorie, **mehrfach** pro Eintrag zuweisbar und filterbar; im
  Detailpanel sichtbar.
- **Verbindungen** per Toolbar ein-/ausblendbar.
- **Quellen-Filter** und **Buch-Felder** (Verlag/Jahr/ISBN) ergänzt.

## Darstellung: Personen-Zeilen & Kästen (2026-06-28)
- **Name + Geburtsjahr im Lebensbalken** (statt am linken Rand); links nur Farb-Punkt.
- **Farbiger Kasten** um alles, was zu einer Person gehört; Kästen überlappen nicht (vertikaler
  Abstand). Lebensbalken oben, Ereignisse darunter.
- **Verbindungen** verlaufen direkt von Ereignis zu Ereignis (statt oben in der Achse).
- **Ereignisse beginnen am Startdatum** (linke Kante = Start, `align:'left'`).

## Strukturelle Neuausrichtung (2026-06-28)
- Aufteilung in **Feld „Ereignisse"** (Welt-Ereignisse: Kriege, Naturereignisse) und
  **Personen** (eigene Zeilen).
- **Kategorien** (verwaltbar, mit Farbe) färben Personen **und** Ereignisse; Ereignisse innerhalb
  einer Person nach eigener Kategorie eingefärbt.
- **Newton** und **Boltzmann** als weitere Beispiel-Personen; Roosevelt als Politiker.
- Übergeordnete Ereignisse als ganzhohe **Hintergrund-Bänder** (Schattierung, abschaltbar).

## Modernes Redesign (2026-06-28)
- Helles, modernes UI (Farben, Typografie, runde Buttons, Schatten); weg vom „90er-Look".
- Mehrere Themen je Eintrag mit Farb-Kodierung (Vorstufe der Kategorien).

## Erste Version / MVP (2026-06-28)
- Reine Web-App (HTML/JS) mit **vis-timeline**; Export als statisches HTML denkbar.
- Personen als Intervalle, Ereignisse als Punkte; Themen farblich; **Verbindungen** zwischen
  Ereignissen (SVG-Overlay); **Quellen** je Eintrag.
- **Speicherung** im Browser (localStorage) + JSON Export/Import; Datenzugriff hinter einer
  `Store`-Schnittstelle (später gegen echte DB/Supabase austauschbar).
- Beispiel-Daten rund um Einstein.
