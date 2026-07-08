# Graph Report - .  (2026-07-06)

## Corpus Check
- Corpus is ~22,577 words - fits in a single context window. You may not need a graph.

## Summary
- 202 nodes · 530 edges · 13 communities (11 shown, 2 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.52)
- Token cost: 60,687 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Datenmodell & Factories|Datenmodell & Factories]]
- [[_COMMUNITY_UI-Modals & Detailpanel|UI-Modals & Detailpanel]]
- [[_COMMUNITY_Filter-Leiste|Filter-Leiste]]
- [[_COMMUNITY_Projekt-Doku & Konzepte|Projekt-Doku & Konzepte]]
- [[_COMMUNITY_SVG-Overlay & Punkt-Layout|SVG-Overlay & Punkt-Layout]]
- [[_COMMUNITY_App-State & Lane-Fitting|App-State & Lane-Fitting]]
- [[_COMMUNITY_Render- & Edit-Orchestrierung|Render- & Edit-Orchestrierung]]
- [[_COMMUNITY_Verbindungs-Link-Modus|Verbindungs-Link-Modus]]
- [[_COMMUNITY_Store & Persistenz|Store & Persistenz]]
- [[_COMMUNITY_Undo & Toolbar|Undo & Toolbar]]
- [[_COMMUNITY_Personen-Drag & Lanes|Personen-Drag & Lanes]]
- [[_COMMUNITY_Dev-Server (no-cache)|Dev-Server (no-cache)]]
- [[_COMMUNITY_GitHub-Pages-Deploy|GitHub-Pages-Deploy]]

## God Nodes (most connected - your core abstractions)
1. `openItemModal()` - 19 edges
2. `init()` - 17 edges
3. `TimelineView` - 15 edges
4. `el()` - 15 edges
5. `OverlayLayer` - 14 edges
6. `FilterBar` - 14 edges
7. `render()` - 14 edges
8. `wireToolbar()` - 14 edges
9. `byId()` - 14 edges
10. `renderDetail()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `test-e2e.html Seed-Testdaten in localStorage (pkm-timeline-v6)` --shares_data_with--> `Store-Schnittstelle (async load/save, LocalStorageStore)`  [INFERRED]
  test-e2e.html → CLAUDE.md
- `README – Zeitleiste Buchnotizen (Nutzer-Doku)` --references--> `getEntryColor Prioritaetskette (filterabhaengige Einfaerbung)`  [EXTRACTED]
  README.md → CLAUDE.md
- `README – Zeitleiste Buchnotizen (Nutzer-Doku)` --references--> `Teil-Daten (YYYY / YYYY-MM / YYYY-MM-DD, Sonderwert now)`  [EXTRACTED]
  README.md → CLAUDE.md
- `CHANGELOG – Entwicklungs-Protokoll der Zeitleiste-App` --references--> `getEntryColor Prioritaetskette (filterabhaengige Einfaerbung)`  [EXTRACTED]
  CHANGELOG.md → CLAUDE.md
- `CHANGELOG – Entwicklungs-Protokoll der Zeitleiste-App` --references--> `vis-Stacking aus (stack:false) — deterministischer nostack-Pfad`  [EXTRACTED]
  CHANGELOG.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **GitHub-Pages-Deployment der statischen App** — _github_workflows_static_deploy, _github_workflows_static2_deploy, index_app_shell [INFERRED 0.85]
- **Drag-and-Drop- und Zeilen-Integritaets-Fluss** — claude_gap_drag, claude_lane_system, claude_nostack, test_e2e_run [EXTRACTED 1.00]
- **Kind-Zeitpunkte im Container-Rahmen halten** — claude_point_layout, claude_overlay_layer, claude_container_konzept, claude_vis_timeline [EXTRACTED 1.00]

## Communities (13 total, 2 thin omitted)

### Community 0 - "Datenmodell & Factories"
Cohesion: 0.10
Nodes (29): assignLanes(), authorName(), byId(), catColor(), CATEGORY_PALETTE, emptyData(), fmtDate(), getEntryColor() (+21 more)

### Community 1 - "UI-Modals & Detailpanel"
Cohesion: 0.19
Nodes (34): catName(), itemColor(), sortedSources(), subcatName(), subcatsOf(), actions(), btn(), dateField() (+26 more)

### Community 2 - "Filter-Leiste"
Cohesion: 0.20
Nodes (7): el(), elText(), FilterBar, label(), sep(), toggle(), sourceLabel()

### Community 3 - "Projekt-Doku & Konzepte"
Cohesion: 0.18
Nodes (18): CHANGELOG – Entwicklungs-Protokoll der Zeitleiste-App, Container-Konzept (personId als generisches Eltern-Feld, isContainer), Einfuege-Zeilen beim Drag (_bindGapDrag, Gap-Gruppen mit Halb-Lane), getEntryColor Prioritaetskette (filterabhaengige Einfaerbung), Lane-/Row-System (assignLanes, fitLane, laneClash, enforceLaneIntegrity, fitRow), vis-Stacking aus (stack:false) — deterministischer nostack-Pfad, OverlayLayer (SVG: Container-Kaesten, Verbindungspfeile, Datums-Pfeile), Platz-Messung der Kind-Zeitpunkte (_computePointLayout, Layout-Stufen) (+10 more)

### Community 4 - "SVG-Overlay & Punkt-Layout"
Cohesion: 0.22
Nodes (5): cssEscape(), MEASURE, OverlayLayer, eventsOf(), worldEvents()

### Community 5 - "App-State & Lane-Fitting"
Cohesion: 0.23
Nodes (14): addItemAt(), collapsed, enforceLaneIntegrity(), fitLane(), fitRow(), isTyping(), linkMode, modalOpen() (+6 more)

### Community 6 - "Render- & Edit-Orchestrierung"
Cohesion: 0.23
Nodes (14): editConnection(), editItem(), focusSearchResult(), handleSelect(), init(), loadDefaultData(), moveEvent(), realId() (+6 more)

### Community 7 - "Verbindungs-Link-Modus"
Cohesion: 0.29
Nodes (11): applyLinkHighlight(), cssEscape(), enterLinkMode(), escLink(), exitLinkMode(), handleItemClick(), hideHint(), setHint() (+3 more)

### Community 8 - "Store & Persistenz"
Cohesion: 0.25
Nodes (3): exportJson(), importJson(), LocalStorageStore

### Community 9 - "Undo & Toolbar"
Cohesion: 0.57
Nodes (7): deleteConnection(), deleteItem(), normalize(), refreshAll(), snapshot(), undo(), wireToolbar()

### Community 10 - "Personen-Drag & Lanes"
Cohesion: 0.60
Nodes (6): handlePersonDrag(), laneClash(), laneSiblings(), movePerson(), normalizeLanes(), persist()

## Knowledge Gaps
- **10 isolated node(s):** `MEASURE`, `store`, `collapsed`, `linkMode`, `undoStack` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TimelineView` connect `Datenmodell & Factories` to `App-State & Lane-Fitting`?**
  _High betweenness centrality (0.177) - this node is a cross-community bridge._
- **Why does `FilterBar` connect `Filter-Leiste` to `App-State & Lane-Fitting`?**
  _High betweenness centrality (0.164) - this node is a cross-community bridge._
- **Why does `OverlayLayer` connect `SVG-Overlay & Punkt-Layout` to `App-State & Lane-Fitting`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `init()` (e.g. with `addItemAt()` and `editConnection()`) actually correct?**
  _`init()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `MEASURE`, `store`, `collapsed` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Datenmodell & Factories` be split into smaller, more focused modules?**
  _Cohesion score 0.09595959595959595 - nodes in this community are weakly interconnected._