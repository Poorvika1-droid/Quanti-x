"""Train the prioritizer calibration from the attached operational dataset."""

from core.ai_training import train_attached_dataset


if __name__ == "__main__":
    report = train_attached_dataset()
    print(f"Trained {report['model']} with {report['samples']} samples.")
