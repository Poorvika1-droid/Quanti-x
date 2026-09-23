"""Engineer/officer workflow persistence tests; Flask is not required."""

import os
import tempfile
import unittest

from core.database import QuantiXDatabase
from core.data_generator import STATIONS, generate_track_sections, generate_maintenance_tasks, generate_train_timetable


class TestPortalWorkflow(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = QuantiXDatabase(os.path.join(self.tmp.name, "portal.db"))
        sections = generate_track_sections()
        stations = [dict(st, division="Quanti-x Corridor", zone="LOCAL", state="Configured") for st in STATIONS]
        tasks = generate_maintenance_tasks(sections, seed=42)
        trains = generate_train_timetable(sections)
        self.db.replace_dataset(stations, sections, tasks, trains, "QUANTI_X_LOCAL")

    def tearDown(self):
        self.tmp.cleanup()

    def _request(self, department="TMS"):
        return self.db.create_maintenance_request({
            "engineer_name": "Quanti-x Engineer",
            "department": department,
            "station_code": "GZB",
            "section_id": "SEC_GZB_MIU_UP",
            "track_line": "UP",
            "start_km": 26.0,
            "end_km": 26.4,
            "task_name": "Field-reported defect",
            "task_category": "RAIL_FLAW",
            "required_duration_mins": 120,
            "min_duration_mins": 60,
            "safety_criticality": 9.0,
            "asset_degradation_score": 8.0,
            "urgency_days_overdue": 3,
            "gmt_accumulated": 60.0,
            "requires_traffic_block": True,
            "requires_power_block": department == "TDMS",
            "requires_st_disconnection": department == "SMMS",
            "required_machines": [],
            "required_gangs": [],
            "horizon": "DAILY",
            "ai_priority": 82.0,
            "ai_classification": "HIGH_PRIORITY",
            "ai_components": {"safety_score": 90.0},
        })

    def test_submission_and_review_state(self):
        req = self._request()
        self.assertEqual(req["request_status"], "SUBMITTED")
        self.db.update_request_analysis(req["request_id"], 86.5, "CRITICAL_EMERGENCY", {"safety_score": 95})
        reviewed = self.db.get_maintenance_request(req["request_id"])
        self.assertEqual(reviewed["request_status"], "UNDER_REVIEW")
        self.assertEqual(reviewed["ai_priority"], 86.5)

    def test_rejection_never_creates_operational_task(self):
        before = self.db.get_counts()["maintenance_tasks"]
        req = self._request("TDMS")
        rejected = self.db.decide_maintenance_request(req["request_id"], "REJECTED", "Officer", "Not feasible", "Do not proceed")
        after = self.db.get_counts()["maintenance_tasks"]
        self.assertEqual(rejected["request_status"], "REJECTED")
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()