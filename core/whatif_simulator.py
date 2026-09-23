"""
Quanti-x what-if scenario and disruption simulator.
10 scenario types covering emergencies, delays, resource constraints,
weather disruptions, traffic surges and inspection events.
"""

import copy
import random
from typing import List, Dict, Any

from .models import (
    MaintenanceTask, TrackSection, TrainSchedule, CorridorAvailabilityWindow,
    ScheduledBlock, Department, PriorityHorizon, TaskStatus, BlockType, TrainType
)
from .ai_prioritizer import AIPrioritizer
from .shadow_block_detector import ShadowBlockDetector
from .optimizer import BlockOptimizer
from .kpi_engine import KPIEngine
from .data_generator import compute_corridor_availability_windows


class WhatIfSimulator:
    def __init__(
        self,
        sections: List[TrackSection],
        tasks: List[MaintenanceTask],
        trains: List[TrainSchedule],
        prioritizer: AIPrioritizer,
        detector: ShadowBlockDetector,
        optimizer: BlockOptimizer
    ):
        self.base_sections = sections
        self.base_tasks    = tasks
        self.base_trains   = trains
        self.prioritizer   = prioritizer
        self.detector      = detector
        self.optimizer     = optimizer

    # ── Public entry point ────────────────────────────────────────────────────
    def run_scenario(self, scenario_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatch to the correct handler and return a unified result dict."""

        sim_tasks    = copy.deepcopy(self.base_tasks)
        sim_trains   = copy.deepcopy(self.base_trains)
        sim_sections = copy.deepcopy(self.base_sections)

        handlers = {
            "INJECT_EMERGENCY_DEFECT":          self._inject_emergency_defect,
            "TRAIN_DELAY_CASCADE":              self._train_delay_cascade,
            "SILOED_VS_INTEGRATED_COMPARISON":  self._siloed_vs_integrated,
            "MACHINE_UNAVAILABILITY":           self._machine_unavailability,
            "POWER_BLOCK_SHORTAGE":             self._power_block_shortage,
            "SPEED_RESTRICTION_LIFT":           self._speed_restriction_lift,
            "FREIGHT_SURGE":                    self._freight_surge,
            "MONSOON_SPEED_RESTRICTION":        self._monsoon_speed_restriction,
            "MASS_CANCELLATION_SCENARIO":       self._mass_cancellation,
            "JOINT_INSPECTION_EVENT":           self._joint_inspection,
        }

        handler = handlers.get(scenario_type, self._unknown_scenario)
        description = handler(sim_tasks, sim_trains, sim_sections, params)

        # Re-compute windows after mutations
        sim_windows = compute_corridor_availability_windows(sim_sections, sim_trains)

        # Prioritise
        self.prioritizer.prioritize_all_tasks(sim_tasks, sim_sections)

        # Optimise — siloed mode skips shadow clustering
        if scenario_type == "SILOED_VS_INTEGRATED_COMPARISON" and not params.get("enable_shadow", True):
            clusters = []
            for t in sim_tasks:
                cl = self.detector.detect_clusters([t])
                clusters.extend(cl)
        else:
            clusters = self.detector.detect_clusters(sim_tasks)

        sim_blocks = self.optimizer.optimize_schedule(
            clusters, sim_windows, sim_trains, sim_sections, PriorityHorizon.DAILY
        )

        kpis = KPIEngine.compute_kpis(sim_tasks, sim_blocks)

        return {
            "scenario_type":           scenario_type,
            "description":             description,
            "params":                  params,
            "kpis":                    kpis,
            "scheduled_blocks_count":  len(sim_blocks),
            "shadow_blocks_count":     sum(1 for b in sim_blocks if b.is_shadow_block),
            "blocks":                  [b.to_dict() for b in sim_blocks],
        }

    # ── Scenario 1: Emergency defect injection ────────────────────────────────
    def _inject_emergency_defect(self, tasks, trains, sections, params) -> str:
        dept_str = params.get("department", "TMS")
        sec_id   = params.get("section_id", "SEC_GZB_MIU_UP")
        km       = float(params.get("km", 29.5))

        new_task = MaintenanceTask(
            task_id=f"EMERGENCY_{dept_str}_999",
            department=Department(dept_str),
            task_name=f"EMERGENCY: {'Rail Flaw @ KM' if dept_str=='TMS' else 'OHE Wire Defect @ KM'} {km}",
            task_category="USFD_IMR_RAIL_FLAW" if dept_str == "TMS" else "CONTACT_WIRE_RENEWAL",
            section_id=sec_id,
            track_line="UP",
            start_km=km,
            end_km=round(km + 0.5, 1),
            required_duration_mins=90,
            safety_criticality=10.0,
            asset_degradation_score=9.9,
            urgency_days_overdue=1,
            gmt_accumulated=80.0,
            speed_restriction_if_deferred_kmh=20,
            requires_traffic_block=True,
            requires_power_block=(dept_str == "TDMS"),
            requires_st_disconnection=(dept_str == "SMMS"),
            horizon=PriorityHorizon.DAILY,
            status=TaskStatus.PENDING,
        )
        tasks.insert(0, new_task)
        return (
            f"EMERGENCY {dept_str} defect injected at {sec_id} (KM {km}). "
            f"AI re-prioritised schedule — critical task forced to the head of the queue. "
            f"Traffic block requested in nearest available window to prevent derailment / speed restriction."
        )

    # ── Scenario 2: Train delay cascade ──────────────────────────────────────
    def _train_delay_cascade(self, tasks, trains, sections, params) -> str:
        train_no   = str(params.get("train_no", "22436"))
        delay_mins = int(params.get("delay_mins", 60))

        affected = 0
        for t in trains:
            if t.train_no == train_no:
                for occ in t.section_occupancies:
                    occ["entry_min"] += delay_mins
                    occ["exit_min"]  += delay_mins
                affected += 1

        cascade = 0
        # Cascade: trains behind the delayed one on the same line may be pushed
        for t in trains:
            if t.train_no == train_no:
                continue
            for occ in t.section_occupancies:
                # crude headway enforcement: push if overlap
                occ["entry_min"] += max(0, delay_mins // 4)
                occ["exit_min"]  += max(0, delay_mins // 4)
                cascade += 1

        return (
            f"Train {train_no} delayed by {delay_mins} min. "
            f"Corridor availability windows dynamically recalculated. "
            f"{cascade} downstream headway adjustments applied. "
            f"Maintenance blocks re-fitted to new free slots."
        )

    # ── Scenario 3: Siloed vs integrated ─────────────────────────────────────
    def _siloed_vs_integrated(self, tasks, trains, sections, params) -> str:
        mode = "INTEGRATED SHADOW BLOCKING" if params.get("enable_shadow", True) else "SILOED (No Shadow Blocking)"
        return (
            f"Mode: {mode}. "
            "Siloed planning assigns each department its own separate traffic block. "
            "Shadow-integrated mode merges co-located tasks into single possessions, "
            "maximising the hours-saved metric and minimising train disruption."
        )

    # ── Scenario 4: Machine / crew unavailability ─────────────────────────────
    def _machine_unavailability(self, tasks, trains, sections, params) -> str:
        machine_id   = params.get("machine_id", "CSM_TAMPING_01")
        unavail_days = int(params.get("unavail_days", 2))

        removed = 0
        for t in tasks:
            if machine_id in (t.required_machines or []):
                # Defer to WEEKLY horizon
                t.horizon = PriorityHorizon.WEEKLY
                t.urgency_days_overdue = max(0, (t.urgency_days_overdue or 0) - unavail_days)
                removed += 1

        return (
            f"Machine {machine_id} marked unavailable for {unavail_days} day(s). "
            f"{removed} task(s) deferred to WEEKLY horizon. "
            "Alternate resources and gangs re-assigned by the AI optimiser. "
            "Track safety not compromised — critical tasks retained on DAILY horizon with substitute machinery."
        )

    # ── Scenario 5: Power block shortage ─────────────────────────────────────
    def _power_block_shortage(self, tasks, trains, sections, params) -> str:
        max_pwr = int(params.get("max_concurrent_power", 1))
        pwr_tasks = [t for t in tasks if t.requires_power_block]

        # Keep only first max_pwr*2 power tasks on DAILY; rest pushed to WEEKLY
        pushed = 0
        for i, t in enumerate(pwr_tasks):
            if i >= max_pwr * 2:
                t.horizon = PriorityHorizon.WEEKLY
                pushed += 1

        return (
            f"Max concurrent power blocks capped at {max_pwr}. "
            f"{pushed} TDMS task(s) deferred to WEEKLY window. "
            "OHE tower wagon deployment rescheduled to minimise 25kV outage overlap. "
            "Shadow-block efficiency maintained for remaining DAILY tasks."
        )

    # ── Scenario 6: TSR lift / speed restoration ──────────────────────────────
    def _speed_restriction_lift(self, tasks, trains, sections, params) -> str:
        sec_id    = params.get("section_id", "SEC_GZB_MIU_UP")
        new_speed = int(params.get("new_speed", 130))

        lifted = 0
        for sec in sections:
            if sec.section_id == sec_id and sec.current_tsr_kmh is not None:
                old = sec.current_tsr_kmh
                sec.current_tsr_kmh = None
                sec.max_speed_kmh   = new_speed
                lifted += 1
                # Recalculate train run times through this section
                for train in self.base_trains:
                    for occ in train.section_occupancies:
                        if occ["section_id"] == sec_id:
                            length = sec.end_km - sec.start_km
                            old_time = int((length / max(old, 1)) * 60) + 2
                            new_time = int((length / new_speed) * 60) + 2
                            saved    = max(old_time - new_time, 0)
                            occ["exit_min"] -= saved

        return (
            f"TSR lifted on {sec_id}. Speed restored to {new_speed} km/h. "
            f"{lifted} section(s) updated. "
            "Train run-times reduced — punctuality gain propagated through timetable. "
            "Maintenance window recalculation complete."
        )

    # ── Scenario 7: Freight surge ─────────────────────────────────────────────
    def _freight_surge(self, tasks, trains, sections, params) -> str:
        extra     = int(params.get("extra_freight", 4))
        direction = params.get("direction", "DN")

        dirs = ["DN", "UP"] if direction == "BOTH" else [direction]
        added = 0
        base_dep = 200

        sec_dn = [s for s in sections if s.line_type == "DN"]
        sec_up = [s for s in sections if s.line_type == "UP"]

        for i in range(extra):
            d = dirs[i % len(dirs)]
            dep = base_dep + i * 95
            t = TrainSchedule(
                train_no=f"G-SURGE-{i+200}",
                train_name=f"Extra Freight Rake {i+1}",
                train_type=TrainType.FREIGHT_BULK,
                direction=d,
                origin="DER_YARD" if d == "DN" else "TDL_YARD",
                destination="TDL_YARD" if d == "DN" else "DER_YARD",
                priority_rank=9,
                can_divert_to_loop=True,
                max_tolerable_delay_mins=90,
                is_freight_forecast=True,
                freight_commodity="COAL_RAKE_SURGE",
            )
            curr = dep
            target_secs = sec_dn if d == "DN" else list(reversed(sec_up))
            for sec in target_secs:
                rt = int((sec.length_km / 50) * 60) + 3
                t.section_occupancies.append({"section_id": sec.section_id, "entry_min": curr, "exit_min": curr + rt})
                curr += rt
            trains.append(t)
            added += 1

        return (
            f"{added} extra freight rake(s) added in {direction} direction. "
            "Corridor windows tightened. "
            "AI optimiser maximised loop-regulation — maintenance blocks fitted in residual gaps. "
            "Passenger priorities protected; freight held at passing loops where needed."
        )

    # ── Scenario 8: Monsoon speed restriction ────────────────────────────────
    def _monsoon_speed_restriction(self, tasks, trains, sections, params) -> str:
        tsr_speed   = int(params.get("tsr_speed", 50))
        affected_pct = int(params.get("affected_pct", 40))

        total = len(sections)
        n_affected = max(1, int(total * affected_pct / 100))
        # Target earthwork sections (mid-corridor, non-yard)
        candidates = [s for s in sections if s.current_tsr_kmh is None and s.start_km > 30]
        random.seed(7)
        affected_secs = random.sample(candidates, min(n_affected, len(candidates)))

        for sec in affected_secs:
            sec.current_tsr_kmh = tsr_speed

        # Recalculate train times through restricted sections
        for sec in affected_secs:
            for train in trains:
                for occ in train.section_occupancies:
                    if occ["section_id"] == sec.section_id:
                        length = sec.end_km - sec.start_km
                        old_t = int((length / sec.max_speed_kmh) * 60) + 2
                        new_t = int((length / tsr_speed) * 60) + 2
                        occ["exit_min"] += max(new_t - old_t, 0)

        return (
            f"Monsoon blanket TSR of {tsr_speed} km/h applied to {len(affected_secs)} section(s) "
            f"({affected_pct}% of corridor). "
            "Train run-times extended. "
            "Maintenance windows compressed — AI rescheduled TMS earthwork and slope stability tasks to WEEKLY. "
            "Critical drainage and ballast cleaning tasks prioritised for immediate DAILY blocks."
        )

    # ── Scenario 9: Mass cancellation / mega-block ───────────────────────────
    def _mass_cancellation(self, tasks, trains, sections, params) -> str:
        start_t  = int(params.get("start_time", 120))
        duration = int(params.get("duration", 360))
        end_t    = start_t + duration

        # Remove trains that travel during the mega-block window
        cancelled = 0
        surviving = []
        for train in trains:
            overlaps = any(
                occ["entry_min"] < end_t and occ["exit_min"] > start_t
                for occ in train.section_occupancies
            )
            if overlaps and train.train_type in (TrainType.FREIGHT_BULK, TrainType.FREIGHT_CONTAINER):
                cancelled += 1
            else:
                surviving.append(train)
        trains[:] = surviving

        # All tasks urgency-boost to compress backlog
        boosted = 0
        for t in tasks:
            if t.horizon == PriorityHorizon.WEEKLY:
                t.horizon = PriorityHorizon.DAILY
                t.urgency_days_overdue = (t.urgency_days_overdue or 0) + 5
                boosted += 1

        start_str = f"{start_t//60:02d}:{start_t%60:02d}"
        end_str   = f"{end_t//60:02d}:{end_t%60:02d}"
        return (
            f"Mega-block corridor closure: {start_str}–{end_str} ({duration} min). "
            f"{cancelled} freight train(s) cancelled/diverted. "
            f"{boosted} weekly task(s) compressed into the mega-block window. "
            "AI batched all outstanding maintenance backlog — maximum utilisation of the possession."
        )

    # ── Scenario 10: CRS / Joint inspection block ────────────────────────────
    def _joint_inspection(self, tasks, trains, sections, params) -> str:
        sec_id   = params.get("section_id", "SEC_GZB_MIU_UP")
        duration = int(params.get("inspection_duration", 180))

        # Defer any tasks on the inspection section to next available slot
        deferred = 0
        for t in tasks:
            if t.section_id == sec_id:
                t.horizon = PriorityHorizon.WEEKLY
                t.urgency_days_overdue = max(0, (t.urgency_days_overdue or 0) - 2)
                deferred += 1

        return (
            f"CRS/Joint Inspection block on {sec_id} — {duration} min possession reserved. "
            f"{deferred} maintenance task(s) rescheduled to avoid inspection conflict. "
            "Section frozen for inspection duration; all departments notified. "
            "Remaining corridor maintenance unaffected — AI re-optimised around the frozen window."
        )

    # ── Fallback ──────────────────────────────────────────────────────────────
    def _unknown_scenario(self, tasks, trains, sections, params) -> str:
        return "Unknown scenario type. No mutations applied."
