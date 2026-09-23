# Quanti-x

**Integrated Automatic Block Planning & Optimisation System**
Indian Railways · Delhi – Aligarh – Tundla · 150 KM High-Density Network Corridor

Quanti-x is a full-stack railway maintenance coordination workspace. Field engineers submit maintenance requirements; the AI engine analyses, prioritises, and schedules them; the control officer reviews evidence and sanctions the final block plan — all in one shared interface backed by SQLite.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Login Credentials](#login-credentials)
3. [Architecture Overview](#architecture-overview)
4. [Feature Reference](#feature-reference)
   - [Landing Page](#landing-page)
   - [Engineer Portal](#engineer-portal)
   - [Officer Portal — Executive Dashboard](#officer-portal--executive-dashboard)
   - [Corridor & GIS Track Map](#corridor--gis-track-map)
   - [Multi-Horizon Gantt Scheduler](#multi-horizon-gantt-scheduler)
   - [Data Hub](#data-hub)
   - [AI Risk & Prioritiser](#ai-risk--prioritiser)
   - [What-If Simulation Studio](#what-if-simulation-studio)
   - [Official IR Memos](#official-ir-memos)
5. [Corridor & Dataset](#corridor--dataset)
6. [Core Engine Modules](#core-engine-modules)
7. [REST API Reference](#rest-api-reference)
8. [Project Structure](#project-structure)
9. [Running Tests](#running-tests)
10. [Resetting Data](#resetting-data)

---

## Quick Start

```powershell
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the server
python run_server.py
```

Open **http://127.0.0.1:5000** in your browser.

> The server seeds the SQLite database automatically on first run. No external downloads or API keys required.

---

## Login Credentials

| Portal | Username | Password | Role |
|--------|----------|----------|------|
| Officer | `officer.demo` | `Officer@123` | Control Officer — approves/rejects requests, manages block plan |
| Engineer | `engineer.demo` | `Engineer@123` | Field Engineer — submits maintenance requirements |

Both portals share the same SQLite operational database (`data/quanti_x.db`).

---

## Architecture Overview

```
Browser
  ├── role_select.html     ← Landing page (portal chooser)
  ├── login.html           ← Secure sign-in
  ├── engineer.html        ← Engineer Portal SPA
  └── index.html           ← Officer Portal SPA (7 tabs)
         │
Flask (web/app.py)
  ├── /api/corridor        ← Stations + sections
  ├── /api/schedules       ← Multi-horizon block plans
  ├── /api/simulate        ← What-if scenario engine
  ├── /api/officer/...     ← Request inbox + decisions
  ├── /api/engineer/...    ← Request submission
  └── ... (20+ endpoints)
         │
Core Engine (core/)
  ├── ai_prioritizer.py    ← Weighted composite priority scorer
  ├── shadow_block_detector.py  ← Multi-dept cluster detection
  ├── optimizer.py         ← Block schedule optimiser
  ├── multi_horizon_planner.py  ← Daily / weekly / monthly plans
  ├── whatif_simulator.py  ← 10-scenario disruption simulator
  ├── kpi_engine.py        ← KPI computation & benchmarking
  ├── report_generator.py  ← IR memo generation (T/351, power, COA)
  └── database.py          ← SQLite persistence layer
         │
SQLite (data/quanti_x.db)
```

---

## Feature Reference

### Landing Page

The role-select page (`/`) was redesigned with two distinct portal cards:

**Engineer Portal card (left)**
- Clean white/sky-blue gradient with subtle dot-grid background pattern
- Animated track schematic SVG showing the 4-step workflow: Submit → AI Triage → Officer Review → Block Sanctioned
- Department chips: TMS Track · SMMS Signal · TDMS OHE
- Hover lift effect with sky-blue border glow

**Officer Portal card (right)**
- Full dark theme matching the Officer Portal (`#0B1120 → #151F32`) — visually consistent with what you see after login
- Live KPI mini-dashboard pulled from `/api/portal/summary`: Asset Availability, Shadow Gain %, Safety %
- Corridor progress bar (NDLS → HRS, 150 KM)
- Tag chips: AI Prioritiser · Shadow Block · Gantt Planner
- Hover lift with violet border glow

---

### Engineer Portal

Accessed at `/engineer`. TMS, SMMS, and TDMS field engineers submit maintenance requirements here.

**Submit Maintenance Requirement form**
- Engineer name, department (TMS / SMMS / TDMS), station (dropdown auto-populated from corridor), adjacent track section (auto-filtered by station)
- Maintenance description, start/end KM, required block duration, planning horizon (DAILY / WEEKLY / MONTHLY)
- Safety criticality (1–10), asset degradation score (1–10), days overdue, GMT accumulated
- TSR speed if deferred (optional), machinery IDs (comma-separated)
- Block type checkboxes: Traffic block · Power block · S&T disconnection

**On submit:**
1. Request stored permanently in SQLite
2. AI pre-triage score calculated immediately (composite 0–100 + classification label)
3. AI preview shown inline before the page refreshes
4. Request appears in the officer inbox

**My Department Requests panel**
- Lists all requests for the logged-in engineer's department
- Shows officer decision and instruction text once sanctioned

---

### Officer Portal — Executive Dashboard

The main control room tab. Contains four sub-sections:

#### Engineer Request Inbox
- Live list of all incoming field requests with real-time status counts (Total / Submitted / Review / Approved / Rejected)
- Filter by status, search by officer name
- Each request card shows: AI pre-triage score, department, station, section, safety criticality, degradation score, days overdue
- **Analyze** button runs the full 6-step decision pipeline and populates the Analysis Panel:
  - AI composite score with component breakdown (safety, degradation, overdue, traffic impact, TSR avoidance)
  - Timetable evidence: all trains traversing the section with entry/exit times
  - Top free maintenance windows for the section
  - Shadow-block opportunity detection (other pending requests in same section)
  - 6-step decision trace (readable log of what the system checked)
- **Approve / Reject** buttons with officer notes; approval converts the request into an optimiser task and triggers full schedule rebuild

#### Station Block Analysis
- Type any station name or code; Quanti-x runs a 6-step workflow:
  1. Station & section mapping
  2. Train timetable check
  3. AI priority calculation
  4. Shadow block detection
  5. Free window search
  6. Optimiser recommendation
- Results shown across three panels: Timetable Check · AI Priority Calculation · Optimiser Output

#### Station Readiness Intelligence
- Bar chart comparing readiness scores (0–100) for all 14 corridor stations
- Readiness formula: `100 − risk_penalty − traffic_penalty + window_credit`
  - risk_penalty: critical tasks × 8 + avg priority × 0.22 (max 52)
  - traffic_penalty: train count × 1.15 (max 22)
  - window_credit: best free window / 12 (max 24)
- Posture classification: **READY** ≥72 · **CONTROLLED** ≥48 · **RESTRICTED** <48

#### AI Block Planner
- Inputs: station, department, duration (min), urgency (NORMAL / HIGH / CRITICAL / EMERGENCY), optional free-text question
- Returns predicted strategy: Bundled joint possession / Staged possession / Safety-first protected possession
- Shows confidence %, readiness score, window-fit assessment, and practical next steps

#### Key Metric Cards
- Fixed Asset Availability (AAI %)
- Shadow Block Hours Saved
- Critical Safety Mitigation %
- Train Delay Impact (mins)

#### Quantitative Benchmark Table
Manual siloed planning vs Quanti-x across 6 dimensions: block utilisation, track downtime hours, train punctuality loss, asset availability, shadow blocking rate, critical safety compliance.

#### Departmental Breakdown & Horizon Distribution
- TMS / SMMS / TDMS request counts and scheduling rates
- Daily / Weekly / Monthly block allocation counts
- TSR Speed Restriction eradication list

---

### Corridor & GIS Track Map

Full SVG schematic of the 150 KM Delhi–Aligarh–Tundla corridor. Rendered by `track_map.js`.

**All 14 stations rendered with:**
- Dual-rail UP and DN track lines with realistic sleeper hatching
- OHE 25kV catenary wire with mast verticals every 8 km
- Platform boxes scaled to actual platform count for each station
- Yard loop arc at junction stations (NDLS, ANVT, GZB, DER, KRJ, ALJN)
- Crossover hatch indicator at junction interlockings
- Station code + name + KM label — alternated above/below to prevent overlap
- Readiness score badge (green ≥72 / amber ≥48 / red <48) from live database

**Track features:**
- Active section colour-coding: blue = clear, red = TSR with speed badge
- Maintenance block overlays from the daily plan: purple dashed = shadow block, blue = single-dept block
- Neutral section (NS) markers at realistic spacing
- 4 traction substations (TSS-GZB, TSS-DER, TSS-KRJ, TSS-ALJN) at 25.4 / 42.1 / 89.4 / 131.2 km
- NR / NCR zone divider at KRJ (89.4 km)
- Colour legend at the bottom

**Interactivity:**
- Click any section → Section Inspector card (speed, signalling, daily density, substation)
- Click any station node → Updates AI Block Planner station selector
- Click any block overlay → Opens Official Memo tab for that block
- Click section from schematic → opens inspector and TSR info

---

### Multi-Horizon Gantt Scheduler

Three-horizon timeline view with station-level granularity.

**Station filter dropdown** — filter all three views to a single station or show all 14.

#### Daily (24-hour) Timeline
- Each of the 14 stations shown as a collapsible group header with block count and shadow count
- Sections nested under their station with 24-column time ruler (00:00–23:00, 1-hr columns)
- Block bars sized and positioned by actual start/end time:
  - Purple gradient + glow animation = Shadow/Joint block
  - Sky blue = TMS traffic block
  - Amber = TDMS power block
  - Green = SMMS disconnection block
- Department badges inside each bar
- 6-hour accent dividers at 06:00, 12:00, 18:00
- **Station activity bar chart** at the bottom — 14 bars showing block load per station; click any bar to filter

#### Weekly (7-day) Rolling
- Per-station workload strip at top — 14 tiles showing block count for the week; click to filter
- Day cards (up to 7) with blocks grouped by station sub-section within each day
- Shadow indicator (⊕) on cards with joint blocks

#### Monthly (30-day) Master
- **Station heatmap grid** — 14 tiles coloured by block intensity (purple=high → dark=none)
- Department split bar for the selected station (TMS / SMMS / TDMS proportions)
- Full sortable table: Date · Station · Block ID · Section · Window · Dept badges · Type badge · Memo button

---

### Data Hub

Unified table view of all maintenance demands loaded from TMS, SMMS, TDMS, and COA timetable.

- Filter by department (TMS / SMMS / TDMS) and horizon (DAILY / WEEKLY / MONTHLY)
- Columns: Task ID · Dept · Category & Details · Section & KM · Duration · Days Overdue · AI Priority · Status

---

### AI Risk & Prioritiser

#### Weight Controls
Five adjustable sliders controlling AI priority weights:
- Safety Risk Score (default 35%)
- Asset Degradation / GMT (default 25%)
- Statutory Overdue Penalty (default 20%)
- Traffic Disruption Impact (default 12%)
- TSR Avoidance Benefit (default 8%)

Sliders update the preview formula in real time. **Recompute AI Priorities** button re-runs the full prioritiser and updates all views.

#### Risk Score & Explainability Table
Ranked list of all tasks showing:
- Rank · Task name · Department
- Safety score component
- Degradation score component
- Overdue penalty component
- Final composite AI score (0–100)

---

### What-If Simulation Studio

**10 fully configurable disruption scenarios**, each with live parameter controls and a per-scenario insight panel.

| # | Scenario | Colour | Key Parameters |
|---|----------|--------|----------------|
| 1 | Emergency Rail / OHE Defect | 🔴 Red | Department, Section, Defect KM |
| 2 | Train Delay Cascade | 🟡 Amber | Train number, Delay (min) |
| 3 | Siloed vs Shadow-Integrated | 🔵 Sky | Enable shadow blocking toggle |
| 4 | Machine / Crew Unavailability | 🟠 Orange | Machine ID, Unavailable days |
| 5 | OHE Power Block Shortage | 🟡 Yellow | Max concurrent power blocks |
| 6 | TSR Lift & Speed Restoration | 🟢 Emerald | Section, Restored speed (km/h) |
| 7 | Freight Traffic Surge | 🟣 Violet | Extra freight trains, Direction |
| 8 | Monsoon Blanket Speed Restriction | 🔵 Blue | TSR speed (km/h), Sections affected (%) |
| 9 | Mass Cancellation / Mega-Block | 🔴 Rose | Closure start (min), Duration (min) |
| 10 | CRS / Joint Inspection Block | 🟣 Purple | Inspection section, Duration (min) |

**How it works:**
1. Parameters are collected from the inline form controls
2. A POST to `/api/simulate` triggers the backend `WhatIfSimulator`
3. The simulator deep-copies the live corridor state, applies the scenario mutation, re-computes availability windows, re-prioritises tasks, and runs the optimiser
4. Results are shown in the KPI delta panel (Scheduled Blocks / Shadow Blocks / Hours Saved / Train Delay) + scenario-specific insight cards + full re-optimised block list

**Scenario mutations:**
- **Emergency Defect** — inserts a safety_criticality=10, priority=1 task; forces it to the head of the daily queue
- **Train Delay** — shifts section occupancy times for the chosen train + cascades headway adjustments to downstream trains
- **Siloed Mode** — disables shadow clustering so every task gets its own isolated block
- **Machine Unavailability** — demotes all tasks requiring the affected machine to WEEKLY horizon
- **Power Block Shortage** — caps concurrent power blocks; pushes surplus TDMS tasks to WEEKLY
- **TSR Lift** — clears TSR flag, restores max speed, recalculates train run-times
- **Freight Surge** — injects N extra TrainSchedule objects with can_divert_to_loop=True
- **Monsoon TSR** — applies blanket speed restriction to a random sample of earthwork sections
- **Mass Cancellation** — removes freight trains from the mega-block window; compresses weekly tasks into the possession
- **Joint Inspection** — freezes the inspected section; defers its maintenance tasks to WEEKLY

---

### Official IR Memos

Auto-generated Indian Railways official documents for any sanctioned block:

- **Form S&T T/351** — Disconnection & re-connection notice
- **TRD Power Block Permit** — 25kV OHE energisation/de-energisation record
- **COA Traffic Block Advice** — Control Office block advice with train regulation list

Select any block from the dropdown, switch memo type, print directly from browser.

---

## Corridor & Dataset

### Simulated Corridor

| Attribute | Value |
|-----------|-------|
| Route | Delhi (NDLS) → Aligarh Jn (ALJN) → Hathras Jn (HRS) |
| Length | 150 KM |
| Type | High-Density Network (HDN) |
| Lines | UP + DN (double-line electrified) |
| Stations | 14 (NDLS, ANVT, SBB, GZB, MIU, DER, AJR, DKDE, WAIR, CHL, KRJ, SOM, ALJN, HRS) |
| Track Sections | 26 (13 UP + 13 DN) |
| Signalling | Automatic Block (0–90 km) · EI Absolute Block (90–150 km) |
| Traction | 25 kV AC OHE — 4 TSS (GZB, DER, KRJ, ALJN) |
| Daily Train Density | 128 trains/day (0–50 km) · 105 trains/day (50–150 km) |
| Passenger Trains | 12 (Vande Bharat, Rajdhani, Shatabdi, Express) |
| Suburban EMUs | 12 (peak-hour GZB–ALJN) |
| Freight Rakes | 11 (coal, container, cement, POL, foodgrain) |

### Maintenance Task Types

| Dept | Categories |
|------|-----------|
| **TMS (Track)** | USFD IMR Rail Flaw, CSM Track Tamping, UNIMAT Turnout Tamping, BCM Ballast Cleaning, Rail Grinding, CWR Destressing, Sleeper Renewal |
| **SMMS (Signal)** | Point Machine POH, AFTC Track Circuit, MSDAC Axle Counter, EI Diagnostics, S&T Cable Meggaring, LC Gate Audit |
| **TDMS (TRD/OHE)** | OHE AOH Tower Wagon, Contact Wire Renewal, Neutral Section Maintenance, High-Voltage Tree Trimming, Substation CB Overhaul, Insulator Washing |

### Supplied Reference Dataset (`/dataset`)

Pan-India Indian Railways reference tables (Year Book 2023-24):

| File | Rows | Contents |
|------|------|----------|
| 01_railway_zones.csv | 19 | All zones, HQ, route length, stations, divisions |
| 02_railway_divisions.csv | 72 | All divisions with parent zone and HQ |
| 03_production_units.csv | 8 | Production units, products, founding dates |
| 04_zonal_departments.csv | 16 | Department structure, HODs |
| 05_psus_and_subsidiaries.csv | 16 | PSUs under Ministry of Railways |
| 06_other_bodies_and_undertakings.csv | 12 | RDSO, RPF, CORE, RLDA, etc. |
| 07_network_summary.csv | 20 | Network totals, electrification, finances |

Real operational data (`/data/kaggle_real`):

| File | Contents |
|------|----------|
| stations.csv | 20 stations NDLS → DDU with lat/lon, platforms, zone |
| trains.csv | 26 trains with type, origin, destination |
| tms_defects_real.csv | Track maintenance defects |
| smms_faults_real.csv | Signalling faults |
| tdms_jobs_real.csv | TRD/OHE maintenance jobs |
| schedules.csv | Train schedules |

---

## Core Engine Modules

| Module | Responsibility |
|--------|---------------|
| `models.py` | All dataclasses: `MaintenanceTask`, `TrackSection`, `TrainSchedule`, `CorridorAvailabilityWindow`, `ScheduledBlock`, `ShadowBlockCluster`, enums |
| `data_generator.py` | Generates corridor stations, track sections, maintenance tasks, train timetable, availability windows |
| `ai_prioritizer.py` | Weighted composite AI priority score (safety, degradation, overdue, traffic, TSR); explain-by-component output |
| `shadow_block_detector.py` | Detects co-located multi-department task clusters eligible for joint shadow possession; computes hours_saved |
| `optimizer.py` | Constraint-based block scheduler — maps clusters to free windows, handles machine/gang conflicts, produces `ScheduledBlock` list |
| `multi_horizon_planner.py` | Runs the optimiser across DAILY, WEEKLY, and MONTHLY horizons with date-stamped block plans |
| `whatif_simulator.py` | 10 scenario handlers — deep-copies corridor state, applies mutations, re-runs full optimise pipeline |
| `kpi_engine.py` | Computes AAI%, shadow hours saved, train delay, safety compliance, 6-dimension manual vs Quanti-x comparison |
| `report_generator.py` | Generates T/351 disconnection notice, TRD power block permit, COA traffic block advice text |
| `database.py` | SQLite CRUD — stations, sections, tasks, trains, maintenance requests, approvals |
| `ai_training.py` | Calibrates AI weight parameters from historical operational rows |
| `attached_dataset.py` | Ingests and normalises the supplied Kaggle real-data CSV files into the runtime database |

---

## REST API Reference

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/portal/summary` | DB health, request counts, operational task count |

### Corridor & Stations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/corridor` | All 14 stations + 26 sections + total length |
| GET | `/api/stations?q=` | Station search (code or name prefix) |
| GET | `/api/station-sections?station=` | Sections adjacent to a station |
| GET | `/api/station-analysis?station=` | Full 6-step workflow for one station |
| GET | `/api/stations/intelligence` | Readiness profiles for all stations |
| POST | `/api/ai/block-plan` | Predict block strategy for a station |

### Schedules & Planning

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedules?horizon=` | DAILY / WEEKLY / MONTHLY / ALL block plans |
| GET | `/api/tasks?department=&horizon=` | Filtered maintenance task list |
| GET | `/api/trains?type=` | Filtered train list |
| GET | `/api/windows` | All corridor availability windows |
| GET | `/api/clusters` | Shadow block cluster summary |
| GET | `/api/kpis` | Recomputed KPI report |
| POST | `/api/reoptimize` | Update AI weights + regenerate all plans |

### Engineer Workflow

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/engineer/requests` | Submit maintenance request |
| GET | `/api/engineer/requests` | List by department / engineer name |
| POST | `/api/engineer/requests/<id>/complete` | Mark completed |

### Officer Workflow

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/officer/requests` | Inbox with status counts |
| POST | `/api/officer/requests/<id>/analyze` | Full AI + timetable analysis |
| POST | `/api/officer/requests/<id>/decision` | APPROVE or REJECT |

### Simulation & Memos

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/simulate` | Run any of 10 what-if scenarios |
| GET | `/api/memo/<block_id>` | T/351, power block, COA memo text |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | DB health check |
| GET | `/api/database/status` | DB metadata and active source |

---

## Project Structure

```
Quanti-x/
├── run_server.py              # Single-command launcher
├── init_db.py                 # Schema initialise / reset
├── train_attached_dataset.py  # Calibrate AI from real data
├── requirements.txt           # Flask, gunicorn
├── README.md                  # This file
│
├── core/                      # Engine modules
│   ├── models.py
│   ├── data_generator.py
│   ├── ai_prioritizer.py
│   ├── shadow_block_detector.py
│   ├── optimizer.py
│   ├── multi_horizon_planner.py
│   ├── whatif_simulator.py    # 10 disruption scenarios
│   ├── kpi_engine.py
│   ├── report_generator.py
│   ├── database.py
│   ├── ai_training.py
│   └── attached_dataset.py
│
├── web/
│   ├── app.py                 # Flask app + 20+ REST endpoints
│   ├── templates/
│   │   ├── role_select.html   # Landing page (dual-card portal chooser)
│   │   ├── login.html         # Secure sign-in
│   │   ├── engineer.html      # Engineer Portal SPA
│   │   └── index.html         # Officer Portal SPA (7 tabs)
│   └── static/
│       ├── css/styles.css
│       └── js/
│           ├── app.js             # Tab switching, data loading, KPI render
│           ├── officer_requests.js # Request inbox + analysis panel
│           ├── engineer_portal.js  # Form submission + request list
│           ├── track_map.js        # SVG corridor schematic (all 14 stations)
│           ├── gantt.js            # Multi-horizon Gantt (station-grouped)
│           └── simulator.js        # 10-scenario What-If Studio
│
├── data/
│   ├── quanti_x.db            # Runtime SQLite (auto-created)
│   ├── quanti_x_training.json # AI calibration output
│   └── schema.sql
│
├── dataset/                   # Pan-India IR reference CSVs
│   ├── 01_railway_zones.csv
│   ├── 02_railway_divisions.csv
│   └── ...
│
└── tests/
    ├── test_all.py
    ├── test_attached_dataset.py
    ├── test_database.py
    └── test_portal_workflow.py
```

---

## Running Tests

```powershell
cd Quanti-x
python -m unittest discover -s tests -p "test*.py"
```

---

## Resetting Data

Reset the SQLite database to seed state:

```powershell
python init_db.py
```

Calibrate AI weights from the supplied real operational data:

```powershell
python train_attached_dataset.py
```

The calibration report is written to `data/quanti_x_training.json`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+ · Flask 3.x |
| Database | SQLite 3 (via Python `sqlite3`) |
| Frontend | Vanilla JS · Tailwind CSS (CDN) · Font Awesome 6 |
| Charts | Chart.js (CDN) |
| Fonts | Inter · JetBrains Mono (Google Fonts) |
| Production server | Gunicorn 23.x |

---

*Quanti-x — Integrated Automatic Block Planning & Optimisation System · Delhi–Kanpur HDN Corridor*
