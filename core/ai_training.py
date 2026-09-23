"""Train a lightweight, dependency-free prioritizer calibration from attached CSVs."""

from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path
from typing import Any

from .attached_dataset import AttachedDataset

FEATURE_NAMES = ("safety", "degradation", "urgency", "traffic", "tsr")
DEFAULT_WEIGHTS = (0.35, 0.25, 0.20, 0.12, 0.08)
LABELS = {"critical": 1.0, "high": 0.75, "medium": 0.5, "low": 0.25}


def _number(value: str | None, default: float = 0.0) -> float:
    try:
        return float(value or default)
    except (TypeError, ValueError):
        return default


def _date_days_overdue(value: str | None) -> int:
    try:
        return max(0, (date.today() - date.fromisoformat((value or "")[:10])).days)
    except ValueError:
        return 0


def _features(rows: list[dict[str, str]], trains: list[dict[str, str]]) -> list[list[float]]:
    train_counts: dict[str, int] = {}
    for row in trains:
        section_id = row.get("section_id", "")
        train_counts[section_id] = train_counts.get(section_id, 0) + 1
    max_trains = max(train_counts.values(), default=1)

    result = []
    for row in rows:
        criticality = LABELS.get((row.get("criticality") or "medium").lower(), 0.5)
        overdue = min(1.0, _date_days_overdue(row.get("due_date")) / 30.0)
        traffic = min(1.0, train_counts.get(row.get("section_id", ""), 0) / max_trains)
        recurrence = min(1.0, _number(row.get("recurrence_count")) / 5.0)
        gap = min(1.0, _number(row.get("inspection_gap_days")) / 90.0)
        tsr = 1.0 if criticality >= 0.75 else 0.4
        degradation = min(1.0, 0.6 * recurrence + 0.4 * gap)
        result.append([criticality, degradation, overdue, traffic, tsr])
    return result


def _targets(rows: list[dict[str, str]]) -> list[float]:
    return [LABELS.get((row.get("criticality") or "medium").lower(), 0.5) for row in rows]


def _rmse(features: list[list[float]], targets: list[float], weights: list[float]) -> float:
    errors = []
    for values, target in zip(features, targets):
        prediction = sum(weight * value for weight, value in zip(weights, values[:5]))
        errors.append((prediction - target) ** 2)
    return math.sqrt(sum(errors) / len(errors)) if errors else 0.0


def train_attached_dataset(
    dataset: AttachedDataset | None = None,
    output_path: str | Path | None = None,
    epochs: int = 2500,
) -> dict[str, Any]:
    """Fit positive normalized feature weights and persist a model report."""
    dataset = dataset or AttachedDataset()
    rows, trains = dataset.training_rows()
    if not rows:
        raise FileNotFoundError(f"No block request data found under {dataset.dataset_dir}")

    raw_features = _features(rows, trains)
    features = raw_features
    targets = _targets(rows)
    weights = list(DEFAULT_WEIGHTS)
    learning_rate = 0.08

    for _ in range(epochs):
        gradients = [0.0] * len(weights)
        for values, target in zip(features, targets):
            error = sum(weight * value for weight, value in zip(weights, values)) - target
            for index, value in enumerate(values):
                gradients[index] += error * value
        for index in range(len(weights)):
            weights[index] = max(0.001, weights[index] - learning_rate * gradients[index] / len(features))
        total = sum(weights)
        weights = [weight / total for weight in weights]

    profile = dataset.profile()
    report: dict[str, Any] = {
        "model": "quanti-x-prioritizer-calibration-v1",
        "trained_at": date.today().isoformat(),
        "samples": len(rows),
        "timetable_rows": len(trains),
        "feature_names": list(FEATURE_NAMES),
        "weights": dict(zip(FEATURE_NAMES, [round(value, 8) for value in weights])),
        "rmse": round(_rmse(features, targets, weights), 6),
        "dataset_profile": profile,
    }

    target = Path(output_path) if output_path else Path(__file__).resolve().parents[1] / "data" / "quanti_x_training.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def load_trained_weights(path: str | Path | None = None) -> dict[str, float] | None:
    target = Path(path) if path else Path(__file__).resolve().parents[1] / "data" / "quanti_x_training.json"
    if not target.exists():
        return None
    try:
        report = json.loads(target.read_text(encoding="utf-8"))
        weights = report.get("weights", {})
        if all(name in weights for name in FEATURE_NAMES):
            return {name: float(weights[name]) for name in FEATURE_NAMES}
    except (OSError, ValueError, TypeError):
        return None
    return None
