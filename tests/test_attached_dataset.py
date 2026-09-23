import unittest
from pathlib import Path

from core.ai_training import load_trained_weights
from core.attached_dataset import AttachedDataset


class TestAttachedDataset(unittest.TestCase):
    def setUp(self):
        self.dataset = AttachedDataset()

    def test_all_attached_tables_are_profiled(self):
        profile = self.dataset.profile()
        self.assertEqual(len(profile["tables"]), 9)
        self.assertEqual(profile["tables"]["railway_zones"]["rows"], 19)
        self.assertEqual(profile["tables"]["railway_divisions"]["rows"], 72)
        self.assertEqual(profile["tables"]["block_requests"]["rows"], 435)
        self.assertEqual(profile["tables"]["train_schedules"]["rows"], 294)

    def test_trained_weights_are_persisted(self):
        weights = load_trained_weights()
        self.assertIsNotNone(weights)
        self.assertAlmostEqual(sum(weights.values()), 1.0, places=4)
        self.assertTrue(all(value > 0 for value in weights.values()))


if __name__ == "__main__":
    unittest.main()
