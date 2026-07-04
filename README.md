# Zeitleiste – Buchnotizen

Eine kleine Web-App, um Notizen aus Büchern auf einer **Zeitleiste** festzuhalten.

- Oben das Feld **Ereignisse** für Welt-Ereignisse (Kriege, Naturereignisse …). Ein Ereignis
  kann selbst **Sub-Ereignisse** enthalten (wie eine Person), die in seinem Rahmen erscheinen.
  Welt-Ereignisse werden ebenfalls platzsparend in Zeilen gepackt und sind vertikal verschiebbar.
- Darunter die **Personen**. Sie werden **platzsparend in Zeilen gepackt**: Personen, deren
  Lebensspannen sich nicht überschneiden, teilen sich eine Zeile. In jeder Person steht der
  **Name + Geburtsjahr oben im Lebensbalken**, die **Ereignisse darunter**; ein **farbiger
  Kasten** umschließt die ganze Person. Beschriftungen sind **mittig** im Balken.
- **Kategorien** (z. B. Wissenschaft, Politik, Kunst, Natur) haben je eine **Farbe** und sind
  frei verwaltbar. Eine Person bekommt eine Kategorie (Wissenschaftler/Politiker/…) → ihre
  Farbe; jedes Ereignis ebenfalls → seine Farbe. So ist Einstein „Wissenschaft"-farben, sein
  politisches Ereignis aber andersfarbig.
- **Filterabhängige Einfärbung:** Die Farbe eines Eintrags richtet sich nach dem Filter-Zustand
  (Prioritätskette): Ist ein **Unterkategorie**-Filter aktiv, färbt die **primäre** Unterkategorie
  (sonst die erste passende sekundäre); ist nur ein **Kategorie**-Filter aktiv, färbt die
  **Kategorie**; ohne aktiven Filter fällt die Farbe auf die primäre Unterkategorie zurück (sonst
  die Kategorie). So lassen sich einzelne Unterkategorien gezielt farblich hervorheben.
- **Verbindungen** verlaufen als Pfeile direkt von Ereignis zu Ereignis; zu jedem Eintrag ist
  die **Quelle** hinterlegt.

## Starten

Reine statische Seite – ein lokaler Webserver genügt (ES-Module brauchen `http://`):

```bash
cd PKM-Tool
python3 serve.py        # → http://localhost:8090  (empfohlen)
# oder:  python3 -m http.server 8090
```

**Empfehlung `serve.py`:** Dieser kleine Server schaltet das Browser-Caching ab. Mit dem
normalen `http.server` cacht der Browser die JavaScript-Dateien aggressiv – nach Änderungen
sieht man dann ohne **hartes** Neuladen (`Cmd/Strg + Shift + R`) die alte Version (das war die
Ursache, wenn neue Funktionen „nicht zu gehen" schienen). `serve.py` vermeidet das.

Beim ersten Start werden Beispiel-Daten geladen.

## Bedienung

- **＋ Eintrag** / Doppelklick auf freie Stelle: neuen Eintrag anlegen. Im Dialog die **Art**
  wählen — Ereignis oder Person; beim Ereignis zusätzlich die zugehörige Person (oder
  „Welt-Ereignis"), Kategorie und (Mehrfach-)Unterkategorien. Die Unterkategorien erscheinen als
  **geordnete Chips**: die **erste** ist die primäre und bestimmt die **Farbe** (per ▲▼
  umsortierbar). Ein **Live-Farbfeld** zeigt sofort die resultierende Farbe auf der Zeitleiste.
- **Datum**: nur das **Jahr ist Pflicht**, Monat und Tag sind optional (Felder Jahr/Monat/Tag).
  Beim **Ende** gibt es zusätzlich **„läuft bis heute"** – dann reicht der Balken bis zur
  Gegenwart (z. B. lebende Personen).
  Ein Ereignis mit Start **und** Ende wird als eckiger Balken gezeichnet; nur mit Start als
  eckiges Kästchen, dessen **Kante genau auf dem Startdatum** liegt — durch einen kleinen **Pfeil**
  markiert. Lange Titel verlängern das Kästchen **nicht**, sondern werden abgeschnitten (Volltext
  im Tooltip) — wie bei den Personen-Balken.
- **Ereignisse bleiben im Rahmen:** Der farbige Rahmen ist nur so **breit wie der Balken** der
  Person bzw. des Container-Ereignisses, und die Ereignisse darin überschreiten ihn **nie**.
  Reicht der Platz für ein Kästchen nicht, weicht es automatisch aus — erst auf die andere Seite
  des Datums, dann mit **kleinerer Schrift**, und wenn auch das nicht passt, bleibt nur eine
  schmale **Markierung** übrig, die beim **Drüberhovern** das Ereignis anzeigt.
- **Zoomen & Navigieren** (macOS-üblich): **Pinch-Geste** auf dem Trackpad oder
  **Cmd/Strg + Mausrad** zoomt um den Cursor. **Zwei Finger links/rechts** verschiebt die
  Zeitleiste horizontal, **zwei Finger hoch/runter** (bzw. Mausrad allein) scrollt vertikal —
  zoomt also **nicht** mehr. Horizontales Ziehen mit gedrückter Maustaste pannt weiterhin.
- **Klick**: Details rechts. **Doppelklick auf einen Container** (Person oder Ereignis mit
  Sub-Ereignissen): ein-/ausklappen.
  **Doppelklick auf ein Ereignis**: bearbeiten.
- **Datum/Fachliches** ändert man **nur über Bearbeiten** — nicht durch Ziehen.
- **Vertikal verschieben**: eine **Person** per **Maus** in eine andere Zeile ziehen (oder im
  Detailpanel ▲ höher / ▼ tiefer); Personen ohne Zeit-Überschneidung dürfen sich eine Zeile
  teilen. Ein **Ereignis** verschiebt man über das Detailpanel (▲/▼ „Unterzeile") in eine andere
  Unterzeile innerhalb seiner Person.
- **🔗 Verknüpfen**: Quelle anklicken → Ziel anklicken → Beziehung wählen.
  (Oder im Detailpanel „Verknüpfen".) Klick auf einen Pfeil = bearbeiten/löschen.
- **↔ Verbindungen**: alle Verknüpfungspfeile ein-/ausblenden.
- **⊟ Einklappen**: alle Lebensereignisse ein-/ausklappen (kompakte Ansicht: nur Lebensbalken).
  Einzeln geht das im Detailpanel einer Person („▾ Ereignisse einklappen").
- **▒ Schattierung**: die ganzhohen Hintergrund-Bänder der Welt-Ereignisse an-/ausschalten.
- **🎨 Kategorien**: anlegen, umbenennen, **Farbe** ändern, löschen — inkl. **Unterkategorien**
  je Kategorie (z. B. Wissenschaft → Physik/Mathematik). Ein Eintrag kann **mehrere**
  Unterkategorien tragen (Mehrfachauswahl im Dialog); sie erscheinen auch im Detailpanel rechts.
- **Filterleiste** (oben): **Kategorien** und **Unterkategorien** als Chips aus-/einblenden;
  **Quelle** als **Dropdown** (sortiert nach Autor-Nachnamen) — so siehst du nur, was aus einer
  bestimmten Quelle stammt. Eine Person ausblenden versteckt auch ihre Ereignisse.
- **📖 Quellen**: verwalten. Die Maske passt sich der **Art** an (Buch → Verlag/ISBN, Paper →
  Journal/DOI/Band/Heft, Webseite → URL/abgerufen …); Autor mit **Vor- und Nachname**. Anzeige
  überall als „Nachname, Vorname – Titel".
  **⤢ Einpassen**: gesamte Zeitspanne ins Bild rücken.
- **⬇ Export / ⬆ Import**: Daten als JSON sichern bzw. laden.

## Speicherung

Daten liegen automatisch im **Browser** (`localStorage`) und überleben Reloads.
Mit **Export/Import** lassen sich JSON-Sicherungen erstellen und teilen.

### Später: echte Datenbank

Aller Datenzugriff läuft über die `Store`-Schnittstelle in [`js/store.js`](js/store.js)
(`load()` / `save()`, beide `async`). Für eine echte Datenbank (z. B. **Supabase**)
genügt eine zweite Klasse mit denselben Methoden; in [`js/main.js`](js/main.js) wird statt
`new LocalStorageStore()` dann `new SupabaseStore(...)` instanziiert – **ohne** Änderungen
an UI oder Timeline. Da Supabase direkt aus dem Browser angesprochen wird, bleibt statisches
Hosting (GitHub Pages) möglich.

## Aufbau

| Datei | Aufgabe |
|------|---------|
| `index.html` | Grundgerüst, lädt vis-timeline (CDN) + Module |
| `js/store.js` | Store-Schnittstelle, localStorage, JSON Export/Import |
| `js/model.js` | Datenmodell (`kind`: person/event), Kategorien, Farb-Helfer, Seed-Daten |
| `js/timeline.js` | vis-timeline: Feld „Ereignisse" + Personen-Zeilen, vertikale Sortierung, Trackpad-/Maus-Gesten |
| `js/connections.js` | SVG-Overlay: Rahmen, Verbindungspfeile, Datums-Marker, Platz-Messung der Zeitpunkte |
| `js/filters.js` | Filter-/Legendenleiste (Kategorien) |
| `js/ui.js` | Modals + Detailpanel |
| `js/main.js` | Zustand & Verdrahtung |
| `data/sample.json` | Beispiel-Datensatz (auch als Import-Vorlage) |
| `serve.py` | Dev-Server ohne Browser-Cache (empfohlen zum Starten) |
| `CHANGELOG.md` | Entwicklungs-Protokoll |
| `# Backlog` | offene/erledigte Aufgaben |
