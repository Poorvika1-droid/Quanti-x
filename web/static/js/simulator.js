/**
 * Quanti-x - Interactive What-If Disruption Simulator
 * 10 scenario types with live parameter controls and rich result rendering.
 */

// ── Scenario catalogue ────────────────────────────────────────────────────────
const SIM_SCENARIOS = [
  {
    id: 'INJECT_EMERGENCY_DEFECT',
    icon: 'fa-triangle-exclamation',
    color: 'red',
    title: 'Emergency Rail/OHE Defect',
    desc: 'Inject a critical USFD flaw or burnt OHE contact-wire defect mid-corridor. AI re-prioritises and reschedules within available traffic windows.',
    params: [
      { id:'department',   label:'Department',  type:'select', options:['TMS','SMMS','TDMS'], default:'TMS' },
      { id:'section_id',   label:'Section',     type:'select',
        options:['SEC_GZB_MIU_UP','SEC_KRJ_SOM_DN','SEC_ALJN_HRS_UP','SEC_DER_AJR_DN','SEC_NDLS_ANVT_UP'], default:'SEC_GZB_MIU_UP' },
      { id:'km',           label:'Defect KM',   type:'number', default:29.5, min:0, max:150, step:0.1 },
    ]
  },
  {
    id: 'TRAIN_DELAY_CASCADE',
    icon: 'fa-clock-rotate-left',
    color: 'amber',
    title: 'Train Delay Cascade',
    desc: 'Delay a flagship express. Watch how corridor availability windows shift and the AI re-optimises maintenance blocks around the new headway gaps.',
    params: [
      { id:'train_no',    label:'Train No.',   type:'select',
        options:['22436','12302','12001','12417','12418','12560','12398'], default:'22436' },
      { id:'delay_mins',  label:'Delay (min)', type:'number', default:60, min:10, max:240, step:5 },
    ]
  },
  {
    id: 'SILOED_VS_INTEGRATED_COMPARISON',
    icon: 'fa-code-compare',
    color: 'sky',
    title: 'Siloed vs Shadow-Integrated',
    desc: 'Compare traditional department-by-department planning (no shadow blocking) against Quanti-x integrated scheduling. See hours saved.',
    params: [
      { id:'enable_shadow', label:'Enable shadow blocking', type:'toggle', default: true },
    ]
  },
  {
    id: 'MACHINE_UNAVAILABILITY',
    icon: 'fa-wrench',
    color: 'orange',
    title: 'Machine / Crew Unavailability',
    desc: 'Simulate key machinery breakdown (CSM tamping, tower wagon) or crew shortage. Quanti-x reallocates and reschedules affected tasks.',
    params: [
      { id:'machine_id',   label:'Machine',  type:'select',
        options:['CSM_TAMPING_01','TOWER_WAGON_TRD_01','UNIMAT_TURNOUT_02','BCM_MACHINE_03','WELD_GENSET_01'], default:'CSM_TAMPING_01' },
      { id:'unavail_days', label:'Unavailable (days)', type:'number', default:2, min:1, max:7, step:1 },
    ]
  },
  {
    id: 'POWER_BLOCK_SHORTAGE',
    icon: 'fa-bolt',
    color: 'yellow',
    title: 'OHE Power Block Shortage',
    desc: 'Reduce the permitted number of simultaneous power blocks. Quanti-x redistributes TDMS tasks across alternate windows without missing critical items.',
    params: [
      { id:'max_concurrent_power', label:'Max concurrent power blocks', type:'number', default:1, min:1, max:4, step:1 },
    ]
  },
  {
    id: 'SPEED_RESTRICTION_LIFT',
    icon: 'fa-gauge-high',
    color: 'emerald',
    title: 'TSR Lift & Speed Restoration',
    desc: 'Simulate lifting an active Temporary Speed Restriction after maintenance completion. See punctuality gain and revised capacity figures.',
    params: [
      { id:'section_id', label:'TSR Section', type:'select',
        options:['SEC_GZB_MIU_UP','SEC_DER_AJR_DN','SEC_KRJ_SOM_DN'], default:'SEC_GZB_MIU_UP' },
      { id:'new_speed',  label:'Restored speed (km/h)', type:'number', default:130, min:30, max:160, step:5 },
    ]
  },
  {
    id: 'FREIGHT_SURGE',
    icon: 'fa-train',
    color: 'violet',
    title: 'Freight Traffic Surge',
    desc: 'Add extra goods rakes from Control Office. Quanti-x tightens maintenance windows, maximises loop-regulation, and minimises possession overlap.',
    params: [
      { id:'extra_freight', label:'Additional freight trains', type:'number', default:4, min:1, max:12, step:1 },
      { id:'direction',     label:'Direction', type:'select', options:['DN','UP','BOTH'], default:'DN' },
    ]
  },
  {
    id: 'MONSOON_SPEED_RESTRICTION',
    icon: 'fa-cloud-rain',
    color: 'blue',
    title: 'Monsoon Blanket Speed Restriction',
    desc: 'Apply monsoon-season blanket TSR across vulnerable earthwork sections. See the cascading impact on maintenance window availability and train running.',
    params: [
      { id:'tsr_speed',    label:'Blanket TSR speed (km/h)', type:'number', default:50, min:20, max:75, step:5 },
      { id:'affected_pct', label:'Sections affected (%)',    type:'number', default:40, min:10, max:80, step:5 },
    ]
  },
  {
    id: 'MASS_CANCELLATION_SCENARIO',
    icon: 'fa-ban',
    color: 'rose',
    title: 'Mass Train Cancellation Window',
    desc: 'Simulate a planned mega-block (e.g., bridge girder erection) requiring 6–8 hour corridor closure. AI compresses outstanding maintenance backlog.',
    params: [
      { id:'start_time',   label:'Closure starts (min)', type:'number', default:120, min:0,   max:1380, step:30 },
      { id:'duration',     label:'Closure duration (min)', type:'number', default:360, min:120, max:600, step:30 },
    ]
  },
  {
    id: 'JOINT_INSPECTION_EVENT',
    icon: 'fa-magnifying-glass',
    color: 'purple',
    title: 'CRS / Joint Inspection Block',
    desc: 'Schedule a Commissioner of Railway Safety or senior officer joint inspection. Quanti-x freezes a section window and reschedules colliding maintenance.',
    params: [
      { id:'section_id',   label:'Inspection section', type:'select',
        options:['SEC_GZB_MIU_UP','SEC_KRJ_SOM_DN','SEC_ALJN_HRS_DN'], default:'SEC_GZB_MIU_UP' },
      { id:'inspection_duration', label:'Duration (min)', type:'number', default:180, min:60, max:480, step:30 },
    ]
  },
];

// ── colour map ────────────────────────────────────────────────────────────────
const SIM_COLORS = {
  red:     { ring:'border-red-500/40',    badge:'bg-red-500/20 text-red-300',     btn:'bg-red-600 hover:bg-red-500'     },
  amber:   { ring:'border-amber-500/40',  badge:'bg-amber-500/20 text-amber-300', btn:'bg-amber-600 hover:bg-amber-500' },
  sky:     { ring:'border-sky-500/40',    badge:'bg-sky-500/20 text-sky-300',     btn:'bg-sky-600 hover:bg-sky-500'     },
  orange:  { ring:'border-orange-500/40', badge:'bg-orange-500/20 text-orange-300',btn:'bg-orange-600 hover:bg-orange-500'},
  yellow:  { ring:'border-yellow-500/40', badge:'bg-yellow-500/20 text-yellow-300',btn:'bg-yellow-600 hover:bg-yellow-500'},
  emerald: { ring:'border-emerald-500/40',badge:'bg-emerald-500/20 text-emerald-300',btn:'bg-emerald-600 hover:bg-emerald-500'},
  violet:  { ring:'border-violet-500/40', badge:'bg-violet-500/20 text-violet-300',btn:'bg-violet-600 hover:bg-violet-500'},
  blue:    { ring:'border-blue-500/40',   badge:'bg-blue-500/20 text-blue-300',   btn:'bg-blue-600 hover:bg-blue-500'   },
  rose:    { ring:'border-rose-500/40',   badge:'bg-rose-500/20 text-rose-300',   btn:'bg-rose-600 hover:bg-rose-500'   },
  purple:  { ring:'border-purple-500/40', badge:'bg-purple-500/20 text-purple-300',btn:'bg-purple-600 hover:bg-purple-500'},
};

// ── Build scenario cards (called once when tab opens) ─────────────────────────
function initSimulator() {
  const grid = document.getElementById('sim-scenario-grid');
  if (!grid || grid.dataset.built) return;
  grid.dataset.built = '1';

  grid.innerHTML = SIM_SCENARIOS.map((sc, idx) => {
    const c = SIM_COLORS[sc.color] || SIM_COLORS.sky;
    const paramHtml = sc.params.map(p => {
      if (p.type === 'select') {
        return `<label class="text-[10px] text-slate-400">${p.label}
          <select id="sim-p-${sc.id}-${p.id}"
                  class="mt-0.5 w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-white">
            ${p.options.map(o => `<option value="${o}" ${o===p.default?'selected':''}>${o}</option>`).join('')}
          </select></label>`;
      }
      if (p.type === 'toggle') {
        return `<label class="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
          <input type="checkbox" id="sim-p-${sc.id}-${p.id}" ${p.default?'checked':''} class="rounded">
          ${p.label}</label>`;
      }
      return `<label class="text-[10px] text-slate-400">${p.label}
        <input type="number" id="sim-p-${sc.id}-${p.id}"
               value="${p.default}" min="${p.min||0}" max="${p.max||9999}" step="${p.step||1}"
               class="mt-0.5 w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-white font-mono">
        </label>`;
    }).join('');

    return `
      <div class="bg-rail-card rounded-xl border ${c.ring} p-4 space-y-3 flex flex-col">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.badge}">
            <i class="fa-solid ${sc.icon} text-base"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="text-sm font-bold text-white">${sc.title}</h4>
              <span class="text-[9px] font-mono px-1.5 py-0.5 rounded ${c.badge} uppercase tracking-wider">
                Scenario ${idx+1}
              </span>
            </div>
            <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">${sc.desc}</p>
          </div>
        </div>

        ${sc.params.length ? `
        <div class="grid grid-cols-2 gap-2">
          ${paramHtml}
        </div>` : ''}

        <button onclick="runSimulationScenario('${sc.id}')"
                class="mt-auto w-full py-2 rounded-lg text-white text-xs font-bold transition flex items-center justify-center gap-2 ${c.btn}">
          <i class="fa-solid fa-play"></i> Run Scenario
        </button>
      </div>`;
  }).join('');
}

// ── Run simulation ────────────────────────────────────────────────────────────
async function runSimulationScenario(scenarioType) {
  const descBox = document.getElementById('sim-scenario-description');
  const badge   = document.getElementById('sim-status-badge');
  const results = document.getElementById('sim-results-panel');

  if (descBox) descBox.innerText = 'Simulating disruption and running AI Constraint Solver…';
  if (badge) {
    badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono animate-pulse';
    badge.innerText  = 'Computing Re-optimisation…';
  }
  if (results) results.classList.add('opacity-40', 'pointer-events-none');

  // ── Collect params from DOM inputs ────────────────────────────────────────
  const sc = SIM_SCENARIOS.find(s => s.id === scenarioType);
  const params = {};
  if (sc) {
    sc.params.forEach(p => {
      const el = document.getElementById(`sim-p-${scenarioType}-${p.id}`);
      if (!el) return;
      if (p.type === 'toggle') params[p.id] = el.checked;
      else if (p.type === 'number') params[p.id] = parseFloat(el.value);
      else params[p.id] = el.value;
    });
  }

  // Map toggle scenario id correctly for backend
  let backendScenario = scenarioType;
  if (scenarioType === 'SILOED_VS_INTEGRATED_COMPARISON') {
    backendScenario = 'SILOED_VS_INTEGRATED_COMPARISON';
  }

  const payload = { scenario: backendScenario, params };

  try {
    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    renderSimulationResults(res, scenarioType);
  } catch (err) {
    console.error('Simulation error:', err);
    if (descBox) descBox.innerText = 'Simulation request failed – check server logs.';
    if (badge) {
      badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono';
      badge.innerText  = 'Error';
    }
  } finally {
    if (results) results.classList.remove('opacity-40', 'pointer-events-none');
  }
}

// ── Render results ────────────────────────────────────────────────────────────
function renderSimulationResults(simData, scenarioType) {
  const descBox  = document.getElementById('sim-scenario-description');
  const badge    = document.getElementById('sim-status-badge');
  const kpiBlocks = document.getElementById('sim-kpi-blocks');
  const kpiShadow = document.getElementById('sim-kpi-shadow');
  const kpiSaved  = document.getElementById('sim-kpi-saved');
  const kpiDelay  = document.getElementById('sim-kpi-delay');
  const blockList = document.getElementById('sim-block-list');
  const extraPanel= document.getElementById('sim-extra-panel');

  if (descBox) descBox.innerText = simData.description || 'Simulation complete.';
  if (badge) {
    badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono';
    badge.innerText  = 'Schedule Re-optimised ✓';
  }

  const summary = (simData.kpis || {}).summary || {};
  if (kpiBlocks) kpiBlocks.innerText = summary.scheduled_blocks ?? simData.scheduled_blocks_count ?? '—';
  if (kpiShadow) kpiShadow.innerText = summary.shadow_blocks    ?? simData.shadow_blocks_count   ?? '—';
  if (kpiSaved)  kpiSaved.innerText  = `${summary.hours_saved_via_shadow ?? '—'}h`;
  if (kpiDelay)  kpiDelay.innerText  = `${summary.total_train_delay_mins ?? '—'}m`;

  // ── Block list ─────────────────────────────────────────────────────────────
  if (blockList && simData.blocks) {
    blockList.innerHTML = simData.blocks.length === 0
      ? `<div class="p-4 text-xs text-slate-500 text-center">No blocks generated for this scenario.</div>`
      : simData.blocks.map(b => `
        <div class="p-2.5 rounded-lg border flex items-center justify-between text-xs
                    ${b.is_shadow_block
                      ? 'bg-purple-950/40 border-purple-800/60'
                      : 'bg-slate-900/80 border-slate-800'}">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold font-mono ${b.is_shadow_block?'text-purple-300':'text-sky-300'}">${b.block_id}</span>
              <span class="font-semibold text-slate-200">${b.section_id}</span>
              <span class="text-slate-500">(${b.track_line} Line)</span>
            </div>
            <div class="text-[10px] text-slate-400 font-mono mt-0.5">
              ${b.start_time_str}–${b.end_time_str} (${b.duration_mins}m)
              ${(b.tasks||[]).length ? '· ' + b.tasks.map(t=>`[${t.department} ${t.task_category}]`).join(' ') : ''}
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[9px] font-mono font-bold shrink-0
                       ${b.is_shadow_block
                         ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                         : 'bg-sky-500/20 text-sky-300'}">
            ${b.is_shadow_block ? 'SHADOW JOINT' : b.block_type}
          </span>
        </div>`).join('');
  }

  // ── Scenario-specific insight panel ───────────────────────────────────────
  if (extraPanel) {
    extraPanel.innerHTML = _buildInsightPanel(simData, scenarioType);
    extraPanel.classList.remove('hidden');
  }
}

function _buildInsightPanel(data, scenarioType) {
  const kpis    = (data.kpis || {}).summary || {};
  const sc      = SIM_SCENARIOS.find(s => s.id === scenarioType);
  const c       = sc ? (SIM_COLORS[sc.color] || SIM_COLORS.sky) : SIM_COLORS.sky;

  const metrics = [
    { label:'Blocks scheduled',        val: data.scheduled_blocks_count  ?? kpis.scheduled_blocks   ?? '—', unit:'' },
    { label:'Shadow joint blocks',     val: data.shadow_blocks_count     ?? kpis.shadow_blocks      ?? '—', unit:'' },
    { label:'Hours saved (shadow)',    val: kpis.hours_saved_via_shadow  ?? '—',                            unit:'h' },
    { label:'Total train delay',       val: kpis.total_train_delay_mins  ?? '—',                            unit:'m' },
    { label:'Critical tasks cleared',  val: kpis.critical_tasks_cleared  ?? '—',                            unit:''  },
    { label:'Asset availability index',val: kpis.asset_availability_index != null
        ? kpis.asset_availability_index.toFixed(1) + '%' : '—',                                             unit:''  },
  ];

  return `
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <i class="fa-solid ${sc ? sc.icon : 'fa-chart-bar'} ${c.badge.split(' ')[1]}"></i>
        <span class="text-sm font-bold text-white">${sc ? sc.title : 'Scenario'} — Results</span>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded ${c.badge}">Re-optimised</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        ${metrics.map(m => `
          <div class="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <div class="text-[9px] font-mono uppercase text-slate-500">${m.label}</div>
            <div class="text-xl font-bold font-mono text-white mt-1">${m.val}${m.unit}</div>
          </div>`).join('')}
      </div>
      ${data.description ? `
      <div class="p-3 rounded-lg border ${c.ring} text-xs text-slate-300 leading-relaxed">
        <i class="fa-solid fa-circle-info mr-2 ${c.badge.split(' ')[1]}"></i>${data.description}
      </div>` : ''}
    </div>`;
}
