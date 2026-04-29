#!/usr/bin/env python3

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = ROOT / "docs" / "additional-spec"
SUMMARY_PATH = DOCS_DIR / "FEAT-SUMMARY.md"
SUMMARY_ROW_RE = re.compile(
    r"^\|\s*(FEAT-\d{5})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|"
    r"\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$"
)
CHECKLIST_ROW_RE = re.compile(
    r"^\|\s*(FEAT-\d{5}-\d{6})\s*\|\s*([^|]+?)\s*\|"
    r"\s*(FEAT-\d{5}-\d{6}-\d{5})\s*\|\s*([^|]+?)\s*\|"
    r"\s*([^|]+?)\s*\|$"
)


def parse_summary() -> dict[str, str]:
    statuses: dict[str, str] = {}
    for raw_line in SUMMARY_PATH.read_text(encoding="utf-8").splitlines():
        match = SUMMARY_ROW_RE.match(raw_line.strip())
        if not match:
            continue
        feat_id, _name, _rd_ref, status, _notes = match.groups()
        statuses[feat_id] = status.strip()
    return statuses


def find_spec_path(feat_id: str) -> Path | None:
    matches = sorted(DOCS_DIR.glob(f"{feat_id}_*.md"))
    return matches[0] if matches else None


def is_closed_status(status: str) -> bool:
    normalized = status.strip()
    return (
        normalized.startswith("✅")
        or normalized.startswith("☑")
        or "手動" in normalized
        or "完了" in normalized
    )


def main() -> int:
    statuses = parse_summary()
    errors: list[str] = []

    for feat_id, summary_status in sorted(statuses.items()):
        if summary_status != "完了":
            continue

        spec_path = find_spec_path(feat_id)
        if spec_path is None:
            errors.append(f"{feat_id}: 仕様ファイルが見つかりません")
            continue

        checklist_rows: list[tuple[str, str, str]] = []
        for raw_line in spec_path.read_text(encoding="utf-8").splitlines():
            match = CHECKLIST_ROW_RE.match(raw_line.strip())
            if not match:
                continue
            section_id, _section_name, test_id, _summary, status = (
                match.groups()
            )
            checklist_rows.append((section_id, test_id, status.strip()))

        if not checklist_rows:
            errors.append(
                f"{feat_id}: テストチェックリストが見つかりません "
                f"({spec_path.relative_to(ROOT)})"
            )
            continue

        for section_id, test_id, checklist_status in checklist_rows:
            if not is_closed_status(checklist_status):
                errors.append(
                    f"{feat_id}: 未完了のチェック項目があります "
                    f"[{section_id} / {test_id} / 状態={checklist_status}] "
                    f"({spec_path.relative_to(ROOT)})"
                )

    if errors:
        print("FEAT completion check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("FEAT completion check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
