#!/usr/bin/env python3
"""Generate data/summary.json for the home and stats pages.

The home and stats pages only need each subject's display name and choice-question
total. Loading the four full question banks (~2.5 MB) for those pages is slow on
mobile networks, so this script writes a tiny summary file instead.

Run from the 408-quiz directory after updating data/*.json:

    python tools/build_summary.py
"""
import json
from pathlib import Path

SUBJECTS = ["数据结构", "操作系统", "计组", "计网"]
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def main() -> None:
    summary = {}
    for subject in SUBJECTS:
        with (DATA / f"{subject}.json").open(encoding="utf-8") as f:
            data = json.load(f)
        total = sum(len(section.get("qs") or []) for section in data["sections"].values())
        summary[subject] = {"name": data["name"], "total": total}
    out = DATA / "summary.json"
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
