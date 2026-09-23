"""Initialize/reset the Quanti-x SQLite database from local planning data."""

from core.database import QuantiXDatabase
from core.data_generator import STATIONS, generate_track_sections, generate_maintenance_tasks, generate_train_timetable


def main():
    sections = generate_track_sections()
    stations = [dict(st, division="Quanti-x Corridor", zone="SUPPLIED", state="Configured") for st in STATIONS]
    tasks = generate_maintenance_tasks(sections, seed=42)
    trains = generate_train_timetable(sections)

    db = QuantiXDatabase()
    db.replace_dataset(stations, sections, tasks, trains, source_name="QUANTI_X_LOCAL")
    print(f"SQLite database ready: {db.db_path}")
    for key, value in db.get_counts().items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()