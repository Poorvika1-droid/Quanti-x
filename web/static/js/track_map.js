/**
 * Quanti-x - Interactive GIS & Track Corridor Schematic
 * All 14 corridor stations rendered with full schematic detail,
 * per-station maintenance demand, TSR markers, and block overlays.
 */

// ── Complete station manifest (matches data_generator.py STATIONS) ──────────
const CORRIDOR_STATIONS = [
  { code:"NDLS", name:"New Delhi",     km:0.0,   hasYard:true,  platforms:16, zone:"NR"  },
  { code:"ANVT", name:"Anand Vihar",   km:12.5,  hasYard:true,  platforms:7,  zone:"NR"  },
  { code:"SBB",  name:"Sahibabad",     km:19.8,  hasYard:false, platforms:5,  zone:"NR"  },
  { code:"GZB",  name:"Ghaziabad Jn", km:25.4,  hasYard:true,  platforms:6,  zone:"NR"  },
  { code:"MIU",  name:"Maripat",       km:35.8,  hasYard:false, platforms:3,  zone:"NR"  },
  { code:"DER",  name:"Dadri",         km:42.1,  hasYard:true,  platforms:4,  zone:"NR"  },
  { code:"AJR",  name:"Ajaibpur",      km:50.3,  hasYard:false, platforms:3,  zone:"NR"  },
  { code:"DKDE", name:"Dankaur",       km:58.7,  hasYard:false, platforms:3,  zone:"NR"  },
  { code:"WAIR", name:"Wair",          km:70.2,  hasYard:false, platforms:2,  zone:"NR"  },
  { code:"CHL",  name:"Chola",         km:77.6,  hasYard:false, platforms:3,  zone:"NR"  },
  { code:"KRJ",  name:"Khurja Jn",    km:89.4,  hasYard:true,  platforms:5,  zone:"NCR" },
  { code:"SOM",  name:"Somna",         km:110.1, hasYard:false, platforms:3,  zone:"NCR" },
  { code:"ALJN", name:"Aligarh Jn",   km:131.2, hasYard:true,  platforms:7,  zone:"NCR" },
  { code:"HRS",  name:"Hathras Jn",   km:150.0, hasYard:false, platforms:4,  zone:"NCR" },
];

const SUBSTATIONS = [
  { km:25.4,  code:"TSS-GZB"  },
  { km:42.1,  code:"TSS-DER"  },
  { km:89.4,  code:"TSS-KRJ"  },
  { km:131.2, code:"TSS-ALJN" },
];

const NEUTRAL_SECTIONS = [18.5, 33.0, 65.0, 110.0, 140.5];

function initTrackMap() {
  renderTrackMap();
}

function renderTrackMap() {
  const container = document.getElementById('track-schematic-svg-container');
  if (!container) return;

  const appStations  = (appState && appState.corridor && appState.corridor.stations && appState.corridor.stations.length)
    ? appState.corridor.stations
    : CORRIDOR_STATIONS.map(s => ({ code:s.code, name:s.name, km:s.km, has_yard:s.hasYard, platforms:s.platforms, zone:s.zone }));

  const sections     = (appState && appState.corridor) ? appState.corridor.sections   : [];
  const dailyBlocks  = (appState && appState.schedules) ? appState.schedules.daily_plan.blocks : [];
  const stProfiles   = Object.fromEntries(
    ((appState && appState.stationIntelligence) || []).map(p => [p.station.code, p])
  );

  // ── SVG dimensions ────────────────────────────────────────────────────────
  const W      = 1200;
  const H      = 430;
  const padL   = 56;
  const padR   = 24;
  const TW     = W - padL - padR;        // total track width
  const TOTAL  = 150.0;
  const sx     = TW / TOTAL;            // pixels per km

  const UP_Y   = 145;
  const DN_Y   = 225;
  const MID_Y  = (UP_Y + DN_Y) / 2;    // 185
  const RG     = 6;                      // rail gap (half-spacing)

  const tx = km => padL + km * sx;

  // ── SVG header ────────────────────────────────────────────────────────────
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
    class="w-full select-none" style="font-family:'JetBrains Mono',monospace;background:#f8fbff;">
  <defs>
    <pattern id="tgrid" width="50" height="50" patternUnits="userSpaceOnUse">
      <path d="M50 0L0 0 0 50" fill="none" stroke="#dbe4ef" stroke-width="0.4"/>
    </pattern>
    <filter id="glo-b" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glo-r" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glo-p" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="dshadow">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#00000022"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#f8fbff"/>
  <rect width="${W}" height="${H}" fill="url(#tgrid)"/>`;

  // ── Header banner ─────────────────────────────────────────────────────────
  svg += `<rect x="0" y="0" width="${W}" height="24" fill="#172033" opacity="0.94"/>
  <text x="${W/2}" y="15.5" fill="#38bdf8" font-size="10.5" font-weight="bold"
        text-anchor="middle" letter-spacing="1.4">
    DELHI – ALIGARH – TUNDLA  ·  HIGH-DENSITY NETWORK  ·  150 KM  ·  UP &amp; DN
  </text>`;

  // ── Zone divider NR / NCR at KRJ (89.4 km) ───────────────────────────────
  const zoneX = tx(89.4);
  svg += `<line x1="${zoneX}" y1="26" x2="${zoneX}" y2="${H-40}"
                stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="5,3"/>
  <text x="${zoneX-5}" y="35" fill="#94a3b8" font-size="7.5" text-anchor="end">NR · Delhi</text>
  <text x="${zoneX+5}" y="35" fill="#94a3b8" font-size="7.5" text-anchor="start">NCR · Prayagraj</text>`;

  // ── KM ruler ──────────────────────────────────────────────────────────────
  svg += `<line x1="${padL}" y1="44" x2="${W-padR}" y2="44" stroke="#c6d2e0" stroke-width="1"/>`;
  for (let km = 0; km <= 150; km += 10) {
    const x = tx(km);
    svg += `<line x1="${x}" y1="41" x2="${x}" y2="47" stroke="#94a3b8" stroke-width="1.2"/>
            <text x="${x}" y="57" fill="#64748b" font-size="7.5" text-anchor="middle">KM${km}</text>`;
  }
  for (let km = 5; km < 150; km += 10) {
    svg += `<line x1="${tx(km)}" y1="42" x2="${tx(km)}" y2="46" stroke="#c6d2e0" stroke-width="0.8"/>`;
  }

  // ── Direction labels ──────────────────────────────────────────────────────
  svg += `<text x="${padL-8}" y="${UP_Y+4}" fill="#0ea5e9" font-size="9" font-weight="bold" text-anchor="middle">UP▶</text>
  <text x="${padL-8}" y="${DN_Y+4}" fill="#64748b" font-size="9" font-weight="bold" text-anchor="middle">◀DN</text>`;

  // ── OHE catenary ──────────────────────────────────────────────────────────
  svg += `<line x1="${padL}" y1="${UP_Y-24}" x2="${W-padR}" y2="${UP_Y-24}"
                stroke="#fbbf24" stroke-width="1" stroke-dasharray="7,3" opacity="0.5"/>
  <line x1="${padL}" y1="${DN_Y-24}" x2="${W-padR}" y2="${DN_Y-24}"
        stroke="#fbbf24" stroke-width="1" stroke-dasharray="7,3" opacity="0.5"/>`;
  for (let km = 2; km <= 150; km += 8) {
    const x = tx(km);
    svg += `<line x1="${x}" y1="${UP_Y-24}" x2="${x}" y2="${UP_Y-14}" stroke="#fbbf24" stroke-width="0.9" opacity="0.35"/>
    <line x1="${x}" y1="${DN_Y-24}" x2="${x}" y2="${DN_Y-14}" stroke="#fbbf24" stroke-width="0.9" opacity="0.35"/>`;
  }

  // ── Sleepers ──────────────────────────────────────────────────────────────
  const sleeperKmStep = 6 / sx;   // every 6 px → km
  for (let km = 0; km <= 150; km += sleeperKmStep) {
    const x = tx(km);
    if (x > W - padR + 2) break;
    svg += `<line x1="${x}" y1="${UP_Y-RG-3}" x2="${x}" y2="${UP_Y+RG+3}" stroke="#d1d5db" stroke-width="1.4"/>
    <line x1="${x}" y1="${DN_Y-RG-3}" x2="${x}" y2="${DN_Y+RG+3}" stroke="#d1d5db" stroke-width="1.4"/>`;
  }

  // ── Rail baselines ────────────────────────────────────────────────────────
  // UP
  svg += `<line x1="${padL}" y1="${UP_Y-RG}" x2="${W-padR}" y2="${UP_Y-RG}" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
  <line x1="${padL}" y1="${UP_Y+RG}" x2="${W-padR}" y2="${UP_Y+RG}" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>`;
  // DN
  svg += `<line x1="${padL}" y1="${DN_Y-RG}" x2="${W-padR}" y2="${DN_Y-RG}" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
  <line x1="${padL}" y1="${DN_Y+RG}" x2="${W-padR}" y2="${DN_Y+RG}" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>`;

  // Active section colour overlay
  sections.forEach(sec => {
    const x1  = tx(sec.start_km);
    const x2  = tx(sec.end_km);
    const y   = sec.line_type === "UP" ? UP_Y : DN_Y;
    const col = sec.current_tsr_kmh ? "#ef4444" : "#0284c7";
    svg += `<line x1="${x1}" y1="${y-RG}" x2="${x2}" y2="${y-RG}"
                  stroke="${col}" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
    <line x1="${x1}" y1="${y+RG}" x2="${x2}" y2="${y+RG}"
          stroke="${col}" stroke-width="3.5" stroke-linecap="round" opacity="0.75"
          class="track-segment" onclick="inspectSection('${sec.section_id}')"/>`;
    if (sec.current_tsr_kmh) {
      const mid = (x1+x2)/2;
      svg += `<g transform="translate(${mid},${y-20})" filter="url(#glo-r)">
        <rect x="-20" y="-8" width="40" height="16" rx="4" fill="#ef4444"/>
        <text x="0" y="4.5" fill="#fff" font-size="8" font-weight="bold" text-anchor="middle">TSR ${sec.current_tsr_kmh}k</text>
      </g>`;
    }
  });

  // ── Maintenance block overlays ────────────────────────────────────────────
  dailyBlocks.forEach(b => {
    const x1  = tx(b.start_km);
    const bw  = Math.max(tx(b.end_km) - x1, 18);
    const y   = b.track_line === "UP" ? UP_Y : DN_Y;
    const col = b.is_shadow_block ? "#a855f7" : "#3b82f6";
    svg += `<g class="cursor-pointer" onclick="inspectBlock('${b.block_id}')">
      <rect x="${x1}" y="${y-14}" width="${bw}" height="28" rx="4"
            fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="1.8"
            stroke-dasharray="5,2" filter="url(#glo-p)"/>
      <text x="${x1+bw/2}" y="${y+26}" fill="${col}" font-size="7" font-weight="bold" text-anchor="middle">
        ${b.is_shadow_block ? '▲SHADOW' : '●BLOCK'}
      </text>
    </g>`;
  });

  // ── Neutral section markers ───────────────────────────────────────────────
  NEUTRAL_SECTIONS.forEach(km => {
    const x = tx(km);
    svg += `<g transform="translate(${x},${MID_Y})">
      <rect x="-11" y="-7" width="22" height="14" rx="3" fill="#1e293b" stroke="#f59e0b" stroke-width="0.8"/>
      <text x="0" y="4.5" fill="#fbbf24" font-size="6.5" font-weight="bold" text-anchor="middle">NS</text>
    </g>`;
  });

  // ── Traction substations ──────────────────────────────────────────────────
  SUBSTATIONS.forEach(tss => {
    const x = tx(tss.km);
    svg += `<line x1="${x}" y1="${DN_Y+RG+14}" x2="${x}" y2="${H-46}" stroke="#f59e0b" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.5"/>
    <g transform="translate(${x},${H-36})">
      <rect x="-22" y="-10" width="44" height="20" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1"/>
      <text x="0" y="-1" fill="#fbbf24" font-size="6.5" font-weight="bold" text-anchor="middle">${tss.code}</text>
      <text x="0" y="8" fill="#94a3b8" font-size="5.5" text-anchor="middle">25kV AC</text>
    </g>`;
  });

  // ── All 14 Stations ───────────────────────────────────────────────────────
  appStations.forEach((stn, idx) => {
    const x       = tx(stn.km);
    const profile = stProfiles[stn.code];
    const readiness = profile ? profile.readiness_score : null;

    // Node colour by readiness
    let stroke = "#2f8f83";
    if (readiness !== null) {
      stroke = readiness >= 72 ? "#22c55e" : readiness >= 48 ? "#f59e0b" : "#ef4444";
    } else {
      // colour by zone if no profile
      stroke = (stn.zone || stn.division || "").includes("NCR") ? "#a78bfa" : "#38bdf8";
    }

    const isJunction = stn.has_yard || ["NDLS","GZB","KRJ","ALJN","DER","ANVT"].includes(stn.code);
    const nodeR      = isJunction ? 7.5 : 5;

    // Vertical mast
    svg += `<line x1="${x}" y1="60" x2="${x}" y2="${H-46}" stroke="#aebdce" stroke-width="0.7" stroke-dasharray="3,3"/>`;

    // Platform boxes
    const platW = Math.min(Math.max((stn.platforms || 3) * 3.5, 12), 50);
    // UP side
    svg += `<rect x="${x-platW/2}" y="${UP_Y-RG-12}" width="${platW}" height="8" rx="2"
                  fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8" opacity="0.9"/>
    <text x="${x}" y="${UP_Y-RG-6}" fill="#64748b" font-size="5.5" text-anchor="middle">${(stn.platforms||3)}P</text>`;
    // DN side
    svg += `<rect x="${x-platW/2}" y="${DN_Y+RG+4}" width="${platW}" height="8" rx="2"
                  fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8" opacity="0.9"/>`;

    // Junction crossover indicator
    if (isJunction) {
      svg += `<line x1="${x-10}" y1="${UP_Y+RG+2}" x2="${x+10}" y2="${DN_Y-RG-2}"
                    stroke="${stroke}" stroke-width="1.2" stroke-dasharray="2,2" opacity="0.55"/>
      <line x1="${x+10}" y1="${UP_Y+RG+2}" x2="${x-10}" y2="${DN_Y-RG-2}"
            stroke="${stroke}" stroke-width="1.2" stroke-dasharray="2,2" opacity="0.55"/>`;
    }

    // Yard loop arc
    if (stn.has_yard || stn.has_yard === true) {
      svg += `<path d="M${x-20} ${UP_Y+RG+6} Q${x} ${MID_Y} ${x+20} ${DN_Y-RG-6}"
                    fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.5"/>
      <rect x="${x-18}" y="${MID_Y-7}" width="36" height="14" rx="3" fill="#1e293b" filter="url(#dshadow)"/>
      <text x="${x}" y="${MID_Y+4.5}" fill="#38bdf8" font-size="7" font-weight="bold" text-anchor="middle">YARD</text>`;
    }

    // UP & DN station nodes
    const titleTxt = `${stn.name} (${stn.code}) · KM ${stn.km}${stn.platforms ? ' · '+stn.platforms+' platforms' : ''}${readiness !== null ? ' · Readiness '+readiness : ''}`;
    svg += `<g class="station-node cursor-pointer" onclick="inspectStation('${stn.code}')">
      <circle cx="${x}" cy="${UP_Y}" r="${nodeR+3}" fill="transparent"/>
      <circle cx="${x}" cy="${UP_Y}" r="${nodeR}" fill="white" stroke="${stroke}" stroke-width="2.5"
              filter="${isJunction ? 'url(#dshadow)' : ''}"/>
      ${isJunction ? `<circle cx="${x}" cy="${UP_Y}" r="${nodeR-3}" fill="${stroke}" opacity="0.3"/>` : ''}
      <title>${titleTxt}</title>
    </g>
    <g class="station-node cursor-pointer" onclick="inspectStation('${stn.code}')">
      <circle cx="${x}" cy="${DN_Y}" r="${nodeR+3}" fill="transparent"/>
      <circle cx="${x}" cy="${DN_Y}" r="${nodeR}" fill="white" stroke="${stroke}" stroke-width="2.5"/>
    </g>`;

    // ── Label — alternate above/below every other station to avoid overlap ──
    const above = idx % 2 === 0;
    if (above) {
      // code above UP line
      svg += `<text x="${x}" y="${UP_Y-RG-26}" fill="#172033" font-size="9" font-weight="bold" text-anchor="middle">${stn.code}</text>
      <text x="${x}" y="${UP_Y-RG-38}" fill="#475569" font-size="7" text-anchor="middle">${stn.name.replace(' Jn','').replace(' Terminal','')}</text>
      <text x="${x}" y="${UP_Y-RG-48}" fill="#94a3b8" font-size="6.5" text-anchor="middle">KM ${stn.km}</text>`;
      if (readiness !== null) {
        svg += `<text x="${x}" y="${UP_Y-RG-57}" fill="${stroke}" font-size="7" font-weight="bold" text-anchor="middle">R:${readiness}</text>`;
      }
    } else {
      // code below DN line
      svg += `<text x="${x}" y="${DN_Y+RG+26}" fill="#172033" font-size="9" font-weight="bold" text-anchor="middle">${stn.code}</text>
      <text x="${x}" y="${DN_Y+RG+36}" fill="#475569" font-size="7" text-anchor="middle">${stn.name.replace(' Jn','').replace(' Terminal','')}</text>
      <text x="${x}" y="${DN_Y+RG+46}" fill="#94a3b8" font-size="6.5" text-anchor="middle">KM ${stn.km}</text>`;
      if (readiness !== null) {
        svg += `<text x="${x}" y="${DN_Y+RG+55}" fill="${stroke}" font-size="7" font-weight="bold" text-anchor="middle">R:${readiness}</text>`;
      }
    }
  });

  // ── Legend ────────────────────────────────────────────────────────────────
  const legendItems = [
    { col:"#22c55e", label:"High Readiness (≥72)" },
    { col:"#f59e0b", label:"Medium Readiness (48–72)" },
    { col:"#ef4444", label:"Low / TSR Active" },
    { col:"#a855f7", label:"Shadow Block" },
    { col:"#3b82f6", label:"Traffic Block" },
    { col:"#fbbf24", label:"OHE / TSS 25kV" },
  ];
  let lx = padL + 4;
  svg += `<rect x="${padL-2}" y="${H-18}" width="${W-padL-padR}" height="16" fill="#f1f5f9" rx="4" opacity="0.88"/>`;
  legendItems.forEach(li => {
    svg += `<circle cx="${lx+5}" cy="${H-10}" r="4.5" fill="${li.col}"/>
    <text x="${lx+14}" y="${H-6}" fill="#475569" font-size="7.5">${li.label}</text>`;
    lx += li.label.length * 5.2 + 18;
  });

  svg += `</svg>`;
  container.innerHTML = svg;
}

// ── Inspector helpers ─────────────────────────────────────────────────────────
function inspectSection(sectionId) {
  if (!appState || !appState.corridor) return;
  const sec = appState.corridor.sections.find(s => s.section_id === sectionId);
  if (!sec) return;
  const card = document.getElementById('section-inspector-card');
  if (!card) return;
  document.getElementById('inspect-sec-badge').innerText = sec.section_id;
  document.getElementById('inspect-sec-title').innerText =
    `${sec.start_station} → ${sec.end_station} (${sec.line_type} Line, KM ${sec.start_km}–${sec.end_km})`;
  document.getElementById('inspect-sec-details').innerHTML = `
    <div><span class="text-slate-400 block text-[10px]">Speed Limit:</span>
      <span class="font-bold font-mono">${sec.max_speed_kmh} km/h
        ${sec.current_tsr_kmh ? `<span class="text-rose-400">(TSR: ${sec.current_tsr_kmh} km/h)</span>` : ''}</span></div>
    <div><span class="text-slate-400 block text-[10px]">Signaling:</span>
      <span class="font-bold">${sec.signaling_system}</span></div>
    <div><span class="text-slate-400 block text-[10px]">Daily Traffic:</span>
      <span class="font-bold font-mono text-sky-400">${sec.daily_train_density} Trains/Day (${sec.line_capacity_pct}%)</span></div>
    <div><span class="text-slate-400 block text-[10px]">25kV Substation:</span>
      <span class="font-bold text-amber-400 font-mono">${(sec.substations||[]).join(', ')||'N/A'}</span></div>`;
  card.classList.remove('hidden');
}

function inspectStation(stnCode) {
  const plannerStation = document.getElementById('planner-station');
  if (plannerStation) plannerStation.value = stnCode;
  if (appState && appState.corridor) {
    const sec = appState.corridor.sections.find(s => s.start_station === stnCode);
    if (sec) inspectSection(sec.section_id);
  }
}

function inspectBlock(blockId) {
  switchTab('memos');
  const sel = document.getElementById('memo-block-select');
  if (sel) { sel.value = blockId; loadBlockMemo(); }
}

function closeInspector() {
  const card = document.getElementById('section-inspector-card');
  if (card) card.classList.add('hidden');
}
