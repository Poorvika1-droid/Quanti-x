/**
 * Quanti-x - Multi-Horizon Interactive Gantt Timeline
 * Includes station-specific charts for all 14 corridor stations.
 */

let currentGanttHorizon = 'DAILY';
let currentGanttStation = 'ALL';

// ── Station manifest matching data_generator.py ──────────────────────────────
const GANTT_STATIONS = [
  { code:"NDLS", name:"New Delhi",     km:0.0   },
  { code:"ANVT", name:"Anand Vihar",   km:12.5  },
  { code:"SBB",  name:"Sahibabad",     km:19.8  },
  { code:"GZB",  name:"Ghaziabad Jn", km:25.4  },
  { code:"MIU",  name:"Maripat",       km:35.8  },
  { code:"DER",  name:"Dadri",         km:42.1  },
  { code:"AJR",  name:"Ajaibpur",      km:50.3  },
  { code:"DKDE", name:"Dankaur",       km:58.7  },
  { code:"WAIR", name:"Wair",          km:70.2  },
  { code:"CHL",  name:"Chola",         km:77.6  },
  { code:"KRJ",  name:"Khurja Jn",    km:89.4  },
  { code:"SOM",  name:"Somna",         km:110.1 },
  { code:"ALJN", name:"Aligarh Jn",   km:131.2 },
  { code:"HRS",  name:"Hathras Jn",   km:150.0 },
];

function initGantt() {
  _buildStationFilter();
  renderGanttChart();
}

// ── Build the station filter dropdown in the Gantt tab ────────────────────────
function _buildStationFilter() {
  const sel = document.getElementById('gantt-station-filter');
  if (!sel) return;
  sel.innerHTML = `<option value="ALL">All Stations</option>` +
    GANTT_STATIONS.map(s => `<option value="${s.code}">${s.code} – ${s.name}</option>`).join('');
  sel.value = 'ALL';
  sel.onchange = () => { currentGanttStation = sel.value; renderGanttChart(); };
}

function setGanttHorizon(horizon) {
  currentGanttHorizon = horizon;
  ['daily','weekly','monthly'].forEach(h => {
    const btn = document.getElementById(`gantt-btn-${h}`);
    if (!btn) return;
    btn.className = h === horizon.toLowerCase()
      ? "px-3 py-1 rounded-md text-xs font-semibold bg-sky-500 text-white transition"
      : "px-3 py-1 rounded-md text-xs font-semibold text-slate-400 hover:text-white transition";
  });
  renderGanttChart();
}

function renderGanttChart() {
  const container = document.getElementById('gantt-chart-container');
  if (!container || !appState.schedules) return;
  if (currentGanttHorizon === 'DAILY')   renderDailyGantt(container);
  else if (currentGanttHorizon === 'WEEKLY')  renderWeeklyGantt(container);
  else renderMonthlyGantt(container);
}

// ── helper: filter blocks to selected station ─────────────────────────────────
function _filterByStation(blocks) {
  if (currentGanttStation === 'ALL') return blocks;
  const stn = GANTT_STATIONS.find(s => s.code === currentGanttStation);
  if (!stn) return blocks;
  // keep blocks whose km range overlaps the station's km ± 15 km neighbourhood
  return blocks.filter(b => {
    const mid = (b.start_km + b.end_km) / 2;
    return Math.abs(mid - stn.km) <= 15;
  });
}

// ── helper: section → nearest station code ────────────────────────────────────
function _sectionToStation(sectionId) {
  if (!sectionId) return null;
  const parts = sectionId.split('_');
  // SEC_GZB_MIU_UP → parts[1] = GZB
  return parts.length >= 2 ? parts[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. DAILY – 24-hour timeline with station grouping
// ─────────────────────────────────────────────────────────────────────────────
function renderDailyGantt(container) {
  const blocks   = _filterByStation(appState.schedules.daily_plan.blocks);
  const sections = appState.corridor.sections;

  // Group sections by their start-station; keep only ones that have blocks or TSR
  const stationGroups = {};
  GANTT_STATIONS.forEach(s => { stationGroups[s.code] = { station: s, sections: [], blocks: [] }; });

  sections.forEach(sec => {
    const code = _sectionToStation(sec.section_id);
    if (code && stationGroups[code]) stationGroups[code].sections.push(sec);
  });
  blocks.forEach(b => {
    const code = _sectionToStation(b.section_id);
    if (code && stationGroups[code]) stationGroups[code].blocks.push(b);
  });

  // Only render stations that have sections
  const activeGroups = GANTT_STATIONS.filter(s =>
    stationGroups[s.code].sections.length > 0 ||
    stationGroups[s.code].blocks.length > 0
  );

  let html = `
    <div class="bg-slate-950 rounded-xl border border-rail-border overflow-x-auto select-none">
      <!-- Time ruler -->
      <div class="flex items-center border-b border-slate-800 px-4 py-2 min-w-[1000px] sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
        <div class="w-52 shrink-0 text-xs font-mono font-bold text-slate-400 flex items-center gap-2">
          <i class="fa-solid fa-map-pin text-sky-400"></i> Station / Section
        </div>
        <div class="flex-1 grid grid-cols-24 text-[9px] font-mono text-slate-500 text-center">
          ${Array.from({length:24}, (_,i) => `<div class="${i%6===0?'text-slate-300 font-bold':''}">${String(i).padStart(2,'0')}:00</div>`).join('')}
        </div>
      </div>`;

  // Station-grouped rows
  activeGroups.forEach(stn => {
    const group = stationGroups[stn.code];
    const totalBlocks = group.blocks.length;
    const shadowCount = group.blocks.filter(b => b.is_shadow_block).length;
    const hasBlocks   = totalBlocks > 0;

    // Station header row
    html += `
      <div class="flex items-center border-b border-slate-800/60 px-4 py-1.5 min-w-[1000px]
                  ${hasBlocks ? 'bg-sky-950/20' : 'bg-transparent'}">
        <div class="w-52 shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded
                         ${hasBlocks ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'}">
              ${stn.code}
            </span>
            <span class="text-[11px] text-slate-300 truncate">${stn.name}</span>
            <span class="text-[9px] text-slate-500 font-mono">KM ${stn.km}</span>
          </div>
          ${hasBlocks ? `
          <div class="flex gap-1 mt-0.5">
            <span class="text-[8px] font-mono text-sky-400">${totalBlocks} blocks</span>
            ${shadowCount ? `<span class="text-[8px] font-mono text-purple-400">${shadowCount} shadow</span>` : ''}
          </div>` : ''}
        </div>
        <div class="flex-1 h-3 bg-slate-900/20 rounded relative overflow-hidden">
          <!-- Station capacity bar -->
          <div class="absolute inset-y-0 left-0 rounded"
               style="width:${Math.min(totalBlocks*12,100)}%;
                      background:${shadowCount>0?'linear-gradient(90deg,#7c3aed,#0284c7)':'#0284c7'};
                      opacity:0.4;">
          </div>
        </div>
      </div>`;

    // Section rows under this station
    group.sections.forEach(sec => {
      const secBlocks = group.blocks.filter(b => b.section_id === sec.section_id);
      html += `
        <div class="flex items-center h-11 hover:bg-slate-900/50 transition px-4 min-w-[1000px]
                    border-b border-slate-900/60 relative">
          <div class="w-52 shrink-0 pl-3">
            <span class="text-[10px] font-mono text-slate-300 block truncate">${sec.section_id}</span>
            <span class="text-[9px] text-slate-500 font-mono">
              KM ${sec.start_km}–${sec.end_km} · ${sec.line_type}
              ${sec.current_tsr_kmh ? `<span class="text-rose-400 font-bold"> TSR ${sec.current_tsr_kmh}k</span>` : ''}
            </span>
          </div>
          <div class="flex-1 h-8 bg-slate-950/60 rounded border border-slate-800/60 relative overflow-hidden">
            <!-- Hour guidelines -->
            <div class="absolute inset-0 grid grid-cols-24 pointer-events-none divide-x divide-slate-900/40">
              ${Array.from({length:24},()=>'<div></div>').join('')}
            </div>
            <!-- 6-hour accent lines -->
            ${[6,12,18].map(h=>`
              <div class="absolute top-0 bottom-0 border-l border-slate-700/50"
                   style="left:${(h/24)*100}%"></div>
            `).join('')}
            ${secBlocks.map(b => {
              const lp = (b.start_time_mins / 1440) * 100;
              const wp = Math.max((b.duration_mins / 1440) * 100, 4);
              let cls = b.is_shadow_block
                ? 'bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 border-purple-400 text-purple-100 shadow-block-glow'
                : b.block_type === 'POWER_BLOCK'
                  ? 'bg-amber-600 border-amber-400 text-amber-100'
                  : b.block_type === 'DISCONNECTION'
                    ? 'bg-emerald-600 border-emerald-400 text-emerald-100'
                    : 'bg-sky-600 border-sky-400 text-sky-100';
              const deptBadges = (b.departments_involved||[]).slice(0,3)
                .map(d=>`<span class="text-[7px] font-mono px-0.5 bg-black/30 rounded">${d}</span>`).join('');
              return `
                <div class="absolute top-0.5 bottom-0.5 rounded border ${cls}
                            px-1.5 flex items-center justify-between text-[9px]
                            cursor-pointer shadow z-10 hover:scale-[1.03] transition"
                     style="left:${lp}%;width:${wp}%;"
                     onclick="inspectBlock('${b.block_id}')"
                     title="${b.block_id} | ${b.start_time_str}–${b.end_time_str} | ${(b.tasks||[]).length} tasks">
                  <span class="font-mono font-bold truncate">${b.start_time_str}</span>
                  <div class="flex gap-0.5">${deptBadges}</div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    });
  });

  // Station load summary chart (mini bar chart)
  html += `
      <!-- Station Activity Summary -->
      <div class="p-4 border-t border-slate-800 min-w-[1000px]">
        <div class="text-xs font-mono text-slate-400 mb-3 flex items-center gap-2">
          <i class="fa-solid fa-chart-bar text-sky-400"></i>
          Block load by station (today)
        </div>
        <div class="flex items-end gap-1 h-16">
          ${GANTT_STATIONS.map(s => {
            const cnt = stationGroups[s.code].blocks.length;
            const sc  = stationGroups[s.code].blocks.filter(b=>b.is_shadow_block).length;
            const pct = Math.min(cnt * 15, 100);
            const col = sc > 0
              ? 'linear-gradient(to top,#7c3aed,#38bdf8)'
              : cnt > 0 ? '#0284c7' : '#1e293b';
            return `
              <div class="flex flex-col items-center flex-1 group cursor-pointer"
                   onclick="document.getElementById('gantt-station-filter').value='${s.code}';
                            currentGanttStation='${s.code}';renderGanttChart()">
                <span class="text-[7px] font-mono text-slate-500 mb-0.5 group-hover:text-sky-400
                             ${cnt>0?'text-sky-400':''}">${cnt||''}</span>
                <div class="w-full rounded-t transition group-hover:opacity-80"
                     style="height:${Math.max(pct*0.56,2)}px;background:${col};"></div>
                <span class="text-[6.5px] font-mono text-slate-500 mt-0.5 text-center group-hover:text-white">${s.code}</span>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;

  container.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. WEEKLY – 7-day calendar with per-station block cards
// ─────────────────────────────────────────────────────────────────────────────
function renderWeeklyGantt(container) {
  const weekly = appState.schedules.weekly_plan;
  const blocks = _filterByStation(weekly.blocks);

  // Group by date
  const dateGroups = {};
  blocks.forEach(b => {
    if (!dateGroups[b.date_str]) dateGroups[b.date_str] = [];
    dateGroups[b.date_str].push(b);
  });

  // Station-specific block counts for the week
  const stationWeeklyCounts = {};
  GANTT_STATIONS.forEach(s => { stationWeeklyCounts[s.code] = 0; });
  blocks.forEach(b => {
    const code = _sectionToStation(b.section_id);
    if (code && stationWeeklyCounts[code] !== undefined) stationWeeklyCounts[code]++;
  });

  let html = `
    <div class="space-y-5">
      <!-- Weekly header -->
      <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400
                  bg-slate-900/60 p-3 rounded-lg border border-rail-border">
        <span>Rolling 7-day window: <strong class="text-white font-mono">${weekly.start_date} → ${weekly.end_date}</strong></span>
        <span>Total: <strong class="text-sky-400 font-mono">${weekly.total_hours} hrs</strong> across
              <strong class="text-sky-400 font-mono">${weekly.total_blocks} blocks</strong>
              ${currentGanttStation !== 'ALL' ? `<span class="ml-2 text-amber-400">(filtered: ${currentGanttStation})</span>` : ''}
        </span>
      </div>

      <!-- Per-station workload strip -->
      <div class="bg-slate-900/40 rounded-xl border border-rail-border p-4">
        <div class="text-[10px] font-mono text-slate-400 mb-3 uppercase tracking-wider">
          <i class="fa-solid fa-train-track text-sky-400 mr-1"></i> Weekly workload by station
        </div>
        <div class="grid grid-cols-7 sm:grid-cols-14 gap-1">
          ${GANTT_STATIONS.map(s => {
            const cnt = stationWeeklyCounts[s.code];
            const active = cnt > 0;
            return `
              <div class="flex flex-col items-center p-1.5 rounded-lg border cursor-pointer
                          hover:border-sky-500 transition
                          ${currentGanttStation === s.code
                            ? 'border-sky-400 bg-sky-500/10'
                            : active ? 'border-slate-700 bg-slate-900/60' : 'border-slate-800 bg-slate-950/40'}"
                   onclick="document.getElementById('gantt-station-filter').value='${s.code}';
                            currentGanttStation='${s.code}';renderGanttChart()">
                <span class="text-[8px] font-mono font-bold ${active?'text-sky-300':'text-slate-600'}">${s.code}</span>
                <span class="text-[9px] font-bold font-mono ${active?'text-white':'text-slate-700'} mt-0.5">${cnt}</span>
                <span class="text-[7px] text-slate-500">blocks</span>
              </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Day cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        ${Object.keys(dateGroups).sort().map((dateStr, idx) => {
          const dayBlocks = dateGroups[dateStr];
          const shadowCnt = dayBlocks.filter(b => b.is_shadow_block).length;
          // Group by station within this day
          const byStation = {};
          dayBlocks.forEach(b => {
            const code = _sectionToStation(b.section_id) || 'OTHER';
            if (!byStation[code]) byStation[code] = [];
            byStation[code].push(b);
          });
          return `
            <div class="bg-slate-900/60 p-4 rounded-xl border border-rail-border space-y-3">
              <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded font-mono font-bold bg-sky-500/20 text-sky-300 text-[10px]">
                    Day ${idx+1}
                  </span>
                  <span class="font-bold text-slate-200 text-xs font-mono">${dateStr}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-[9px] text-slate-400 font-mono">${dayBlocks.length} blocks</span>
                  ${shadowCnt ? `<span class="text-[9px] text-purple-400 font-mono">${shadowCnt}⊕</span>` : ''}
                </div>
              </div>

              <!-- Station sub-groups -->
              ${Object.keys(byStation).map(code => {
                const stnBlocks = byStation[code];
                const stnInfo = GANTT_STATIONS.find(s => s.code === code);
                return `
                  <div class="space-y-1.5">
                    <div class="text-[9px] font-mono text-slate-500 flex items-center gap-1">
                      <i class="fa-solid fa-location-dot text-sky-500"></i>
                      ${code}${stnInfo ? ` · ${stnInfo.name}` : ''} · KM ${stnInfo ? stnInfo.km : '?'}
                    </div>
                    ${stnBlocks.map(b => `
                      <div class="p-2 rounded-lg border text-xs cursor-pointer
                                  hover:border-sky-500 transition
                                  ${b.is_shadow_block
                                    ? 'bg-purple-950/40 border-purple-800/60'
                                    : 'bg-slate-950 border-slate-800'}"
                           onclick="inspectBlock('${b.block_id}')">
                        <div class="flex items-center justify-between mb-1">
                          <span class="font-bold font-mono ${b.is_shadow_block?'text-purple-300':'text-sky-300'} text-[10px]">
                            ${b.block_id}
                          </span>
                          <span class="text-[9px] font-mono text-slate-400">${b.start_time_str}–${b.end_time_str}</span>
                        </div>
                        <div class="text-[10px] text-slate-300 truncate">${b.section_id}</div>
                        <div class="flex items-center justify-between mt-1 text-[9px]">
                          <span class="text-slate-500 font-mono">${(b.assigned_resources||[]).slice(0,2).join(', ')||'Track Gang'}</span>
                          ${b.is_shadow_block ? '<span class="text-purple-400 font-bold">SHADOW</span>' : ''}
                        </div>
                      </div>`).join('')}
                  </div>`;
              }).join('')}
            </div>`;
        }).join('')}
      </div>
    </div>`;

  container.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. MONTHLY – 30-day master with station heatmap + table
// ─────────────────────────────────────────────────────────────────────────────
function renderMonthlyGantt(container) {
  const monthly = appState.schedules.monthly_plan;
  const blocks  = _filterByStation(monthly.blocks);

  // Build per-station monthly stats
  const stationStats = {};
  GANTT_STATIONS.forEach(s => {
    stationStats[s.code] = { total:0, shadow:0, tms:0, smms:0, tdms:0, hours:0 };
  });
  blocks.forEach(b => {
    const code = _sectionToStation(b.section_id);
    if (!code || !stationStats[code]) return;
    const st = stationStats[code];
    st.total++;
    if (b.is_shadow_block) st.shadow++;
    st.hours += (b.duration_mins || 0) / 60;
    (b.departments_involved || []).forEach(d => {
      if (d === 'TMS') st.tms++;
      else if (d === 'SMMS') st.smms++;
      else if (d === 'TDMS') st.tdms++;
    });
  });
  const maxBlocks = Math.max(1, ...Object.values(stationStats).map(s => s.total));

  let html = `
    <div class="space-y-5">
      <!-- Monthly header -->
      <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400
                  bg-slate-900/60 p-3 rounded-lg border border-rail-border">
        <span>30-day master cyclic schedule:
          <strong class="text-white font-mono">${monthly.start_date} → ${monthly.end_date}</strong></span>
        <span>Cyclic capacity: <strong class="text-purple-400 font-mono">${monthly.total_hours} hrs</strong>
              (${monthly.shadow_blocks} shadow blocks)
              ${currentGanttStation !== 'ALL' ? `<span class="ml-2 text-amber-400">· ${currentGanttStation} filter</span>` : ''}
        </span>
      </div>

      <!-- Station heatmap grid -->
      <div class="bg-slate-900/40 rounded-xl border border-rail-border p-4">
        <div class="text-[10px] font-mono text-slate-400 mb-3 uppercase tracking-wider">
          <i class="fa-solid fa-fire text-amber-400 mr-1"></i> Monthly maintenance heatmap by station
        </div>
        <div class="grid grid-cols-7 sm:grid-cols-14 gap-2">
          ${GANTT_STATIONS.map(s => {
            const st = stationStats[s.code];
            const intensity = st.total / maxBlocks;
            const bg = intensity > 0.75
              ? '#7c3aed' : intensity > 0.5
              ? '#1d4ed8' : intensity > 0.25
              ? '#0369a1' : intensity > 0
              ? '#164e63' : '#0f172a';
            const selected = currentGanttStation === s.code;
            return `
              <div class="rounded-lg p-2 text-center cursor-pointer border transition
                          hover:border-sky-400 ${selected ? 'border-sky-400 ring-1 ring-sky-400' : 'border-slate-700'}"
                   style="background:${bg};"
                   onclick="document.getElementById('gantt-station-filter').value='${s.code}';
                            currentGanttStation='${s.code}';renderGanttChart()">
                <div class="text-[8px] font-mono font-bold text-white">${s.code}</div>
                <div class="text-[11px] font-bold text-white mt-0.5">${st.total}</div>
                <div class="text-[7px] text-slate-300 mt-0.5">${st.hours.toFixed(1)}h</div>
                ${st.shadow ? `<div class="text-[7px] text-purple-300">${st.shadow}⊕</div>` : ''}
              </div>`;
          }).join('')}
        </div>
        <!-- Dept breakdown bars for selected station -->
        ${currentGanttStation !== 'ALL' ? (() => {
          const st = stationStats[currentGanttStation] || {};
          const tot = st.tms + st.smms + st.tdms || 1;
          return `
            <div class="mt-4 flex items-center gap-3 text-xs">
              <span class="text-slate-400 font-mono">Dept split:</span>
              <div class="flex-1 flex rounded overflow-hidden h-4">
                <div style="width:${(st.tms/tot)*100}%;background:#3b82f6"
                     title="TMS ${st.tms}"></div>
                <div style="width:${(st.smms/tot)*100}%;background:#10b981"
                     title="SMMS ${st.smms}"></div>
                <div style="width:${(st.tdms/tot)*100}%;background:#f59e0b"
                     title="TDMS ${st.tdms}"></div>
              </div>
              <span class="text-blue-400 font-mono">TMS ${st.tms}</span>
              <span class="text-emerald-400 font-mono">SMMS ${st.smms}</span>
              <span class="text-amber-400 font-mono">TDMS ${st.tdms}</span>
            </div>`;
        })() : ''}
      </div>

      <!-- Full table -->
      <div class="overflow-x-auto bg-slate-950 rounded-xl border border-rail-border">
        <table class="w-full text-xs text-left text-slate-300">
          <thead class="bg-slate-900/80 text-slate-400 uppercase font-mono border-b border-rail-border sticky top-0">
            <tr>
              <th class="py-2.5 px-3">Date</th>
              <th class="py-2.5 px-3">Station</th>
              <th class="py-2.5 px-3">Block ID</th>
              <th class="py-2.5 px-3">Section</th>
              <th class="py-2.5 px-3">Window</th>
              <th class="py-2.5 px-3">Dept</th>
              <th class="py-2.5 px-3">Type</th>
              <th class="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            ${blocks.map(b => {
              const code = _sectionToStation(b.section_id) || '—';
              const stnInfo = GANTT_STATIONS.find(s => s.code === code);
              return `
                <tr class="hover:bg-slate-900/60 transition">
                  <td class="py-2 px-3 font-mono font-bold text-slate-300">${b.date_str}</td>
                  <td class="py-2 px-3">
                    <span class="font-mono text-sky-400 font-bold">${code}</span>
                    <span class="text-slate-500 ml-1">${stnInfo ? stnInfo.name : ''}</span>
                  </td>
                  <td class="py-2 px-3 font-mono font-semibold ${b.is_shadow_block?'text-purple-400':'text-sky-400'}">
                    ${b.block_id}
                  </td>
                  <td class="py-2 px-3 text-slate-200 font-medium truncate max-w-[160px]">
                    ${b.section_id} <span class="text-slate-500">(KM ${b.start_km}–${b.end_km})</span>
                  </td>
                  <td class="py-2 px-3 font-mono text-slate-300">${b.start_time_str}–${b.end_time_str}
                    <span class="text-slate-500 ml-1">${b.duration_mins}m</span>
                  </td>
                  <td class="py-2 px-3">
                    <div class="flex gap-1 flex-wrap">
                      ${(b.departments_involved||[]).map(d=>`
                        <span class="text-[9px] font-mono px-1.5 py-0.5 rounded
                          ${d==='TMS'?'bg-blue-500/20 text-blue-300':
                            d==='SMMS'?'bg-emerald-500/20 text-emerald-300':
                            'bg-amber-500/20 text-amber-300'}">${d}</span>`).join('')}
                    </div>
                  </td>
                  <td class="py-2 px-3">
                    <span class="px-2 py-0.5 rounded text-[9px] font-mono font-bold
                      ${b.is_shadow_block
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-sky-500/20 text-sky-300'}">
                      ${b.is_shadow_block ? 'SHADOW' : b.block_type}
                    </span>
                  </td>
                  <td class="py-2 px-3 text-right">
                    <button onclick="inspectBlock('${b.block_id}')"
                            class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400
                                   text-[9px] font-bold rounded transition">
                      Memo
                    </button>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  container.innerHTML = html;
}
