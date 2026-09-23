"""SQLite persistence tests that do not require Flask."""

import os
import tempfile
import unittest

from core.ai_prioritizer import AIPrioritizer
from core.database import QuantiXDatabase
from core.data_generator import STATIONS, generate_track_sections, generate_maintenance_tasks, generate_train_timetable


class TestSQLiteDatabase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = QuantiXDatabase(os.path.join(self.tmp.name, "quanti_x_test.db"))
        sections = generate_track_sections()
        stations = [dict(st, division="Quanti-x Corridor", zone="LOCAL", state="Configured") for st in STATIONS]
        tasks = generate_maintenance_tasks(sections, seed=42)
        trains = generate_train_timetable(sections)
        self.db.replace_dataset(stations, sections, tasks, trains, "QUANTI_X_LOCAL")

    def tearDown(self):
        self.tmp.cleanup()

    def test_round_trip_counts(self):
        counts = self.db.get_counts()
        self.assertEqual(counts["stations"], 14)
        self.assertEqual(counts["sections"], 26)
        self.assertEqual(counts["trains"], 35)
        self.assertEqual(counts["maintenance_tasks"], 81)
        self.assertGreater(counts["occupancies"], 0)

    def test_domain_round_trip_and_priority(self):
        sections = self.db.load_sections()
        tasks = self.db.load_tasks()
        trains = self.db.load_trains()
        AIPrioritizer().prioritize_all_tasks(tasks, sections)
        self.assertGreater(max(t.computed_ai_priority for t in tasks), 0.0)
        self.assertTrue(any(t.section_occupancies for t in trains))

    def test_computed_state_persists(self):
        sections = self.db.load_sections()
        tasks = self.db.load_tasks()
        AIPrioritizer().prioritize_all_tasks(tasks, sections)
        self.db.update_task_computed_state(tasks)
        reloaded = self.db.load_tasks()
        self.assertGreater(max(t.computed_ai_priority for t in reloaded), 0.0)
        self.assertEqual(min(t.risk_rank for t in reloaded), 1)


if __name__ == "__main__":
    unittest.main()