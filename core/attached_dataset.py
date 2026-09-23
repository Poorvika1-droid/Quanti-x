"""Load the attached Quanti-x railway datasets without external services."""

from __future__ import annotations

import csv
import ast
import os
from pathlib import Path
from typing import Any


REFERENCE_FILES = {
    "railway_zones": "01_railway_zones.csv",
    "railway_divisions": "02_railway_divisions.csv",
    "production_units": "03_production_units.csv",
    "zonal_departments": "04_zonal_departments.csv",
    "psus_and_subsidiaries": "05_psus_and_subsidiaries.csv",
    "other_bodies_and_undertakings": "06_other_bodies_and_undertakings.csv",
    "network_summary": "07_network_summary.csv",
}

OPERATIONAL_FILES = {
    "block_requests": Path("dataset-1") / "data" / "data_gov_in_block_requests.csv",
    "train_schedules": Path("dataset-1") / "data" / "data_gov_in_train_schedules.csv",
}

ZONE_CORRIDOR_FILE = Path("dataset-1") / "seed" / "corridors_18_zones.py"


class AttachedDataset:
    """Discover and read the attached reference and operational CSV tables."""

    def __init__(self, dataset_dir: str | os.PathLike[str] | None = None):
        if dataset_dir:
            self.dataset_dir = Path(dataset_dir).expanduser().resolve()
        else:
            configured = os.environ.get("QUANTI_X_DATASET_PATH", "").strip()
            if configured:
                self.dataset_dir = Path(configured).expanduser().resolve()
            else:
                app_root = Path(__file__).resolve().parents[1]
                self.dataset_dir = app_root.parent / "dataset"

    @staticmethod
    def _read_csv(path: Path) -> list[dict[str, str]]:
        if not path.exists():
            return []
        with path.open("r", newline="", encoding="utf-8-sig") as handle:
            return [dict(row) for row in csv.DictReader(handle)]

    def load_reference_tables(self) -> dict[str, list[dict[str, str]]]:
        return {
            name: self._read_csv(self.dataset_dir / filename)
            for name, filename in REFERENCE_FILES.items()
        }

    def load_operational_tables(self) -> dict[str, list[dict[str, str]]]:
        return {
            name: self._read_csv(self.dataset_dir / relative_path)
            for name, relative_path in OPERATIONAL_FILES.items()
        }

    def profile(self) -> dict[str, Any]:
        tables = {**self.load_reference_tables(), **self.load_operational_tables()}
        result: dict[str, Any] = {
            "dataset_path": str(self.dataset_dir),
            "tables": {},
        }
        for name, rows in tables.items():
            result["tables"][name] = {
                "rows": len(rows),
                "columns": list(rows[0].keys()) if rows else [],
            }
        return result

    def training_rows(self) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
        tables = self.load_operational_tables()
        return tables["block_requests"], tables["train_schedules"]

    def load_zone_corridors(self) -> list[dict[str, Any]]:
        """Read the attached 18-zone corridor definitions without importing its app."""
        path = self.dataset_dir / ZONE_CORRIDOR_FILE
        if not path.exists():
            return []
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in tree.body:
            if isinstance(node, ast.Assign) and any(
                isinstance(target, ast.Name) and target.id == "ALL_18_ZONE_CORRIDORS"
                for target in node.targets
            ):
                value = ast.literal_eval(node.value)
                return [dict(row) for row in value]
        return []

    def zone_corridor_view(self, zone_code: str | None = None) -> dict[str, Any]:
        corridors = self.load_zone_corridors()
        if zone_code and zone_code.upper() != "ALL":
            corridors = [row for row in corridors if row.get("zone_code", "").upper() == zone_code.upper()]

        stations: dict[str, dict[str, Any]] = {}
        zone_km: dict[str, float] = {}
        for corridor in corridors:
            code_pairs = [
                (corridor.get("section_id", "").split("-")[0], corridor.get("from_station", ""), corridor.get("lat_from"), corridor.get("lon_from")),
                (corridor.get("section_id", "").split("-")[-1], corridor.get("to_station", ""), corridor.get("lat_to"), corridor.get("lon_to")),
            ]
            for code, name, lat, lon in code_pairs:
                if code and code not in stations:
                    stations[code] = {"code": code, "name": name, "km": 0.0, "has_yard": False, "zone": corridor.get("zone_code"), "division": corridor.get("division"), "latitude": lat, "longitude": lon}
            zone_km[corridor.get("zone_code", "")] = zone_km.get(corridor.get("zone_code", ""), 0.0) + float(corridor.get("total_km", 0.0) or 0.0)

        section_rows = []
        cursor_by_zone: dict[str, float] = {}
        for corridor in corridors:
            zone = corridor.get("zone_code", "")
            start_km = cursor_by_zone.get(zone, 0.0)
            end_km = start_km + float(corridor.get("total_km", 0.0) or 0.0)
            cursor_by_zone[zone] = end_km
            start_code = corridor.get("section_id", "").split("-")[0]
            end_code = corridor.get("section_id", "").split("-")[-1]
            stations[start_code]["km"] = min(stations[start_code]["km"], start_km) if stations[start_code]["km"] else start_km
            stations[end_code]["km"] = max(stations[end_code]["km"], end_km)
            section_rows.append({
                "section_id": corridor["section_id"], "corridor_name": corridor["section_name"],
                "start_station": start_code, "end_station": end_code, "line_type": corridor.get("line_type", "double"),
                "start_km": start_km, "end_km": end_km, "max_speed_kmh": 130,
                "current_tsr_kmh": None, "is_electrified": corridor.get("electrified", True),
                "signaling_system": "AUTOMATIC_BLOCK", "daily_train_density": 140 if corridor.get("traffic_density") == "high" else 100,
                "line_capacity_pct": 135.0 if corridor.get("traffic_density") == "high" else 110.0,
                "substations": [], "zone_code": zone, "zone": corridor.get("zone"), "division": corridor.get("division"),
                "from_station": corridor.get("from_station"), "to_station": corridor.get("to_station"),
                "lat_from": corridor.get("lat_from"), "lon_from": corridor.get("lon_from"),
                "lat_to": corridor.get("lat_to"), "lon_to": corridor.get("lon_to"),
            })
        return {"stations": list(stations.values()), "sections": section_rows, "total_length_km": sum(zone_km.values()), "total_sections": len(section_rows)}
