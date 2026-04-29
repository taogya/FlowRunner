#!/usr/bin/env python3
"""TRACEABILITY.md を逆引き形式に変換して出力する。

全セクションの行を逆転（ID列↔関連ID列を入替）し、
逆転後のID列プレフィックスでグルーピングして出力する。

使い方:
    python3 tools/traceability/export-reverse-traceability.py
"""

import re
import sys
from collections import defaultdict
from pathlib import Path

SPEC_DIR = Path("docs/spec")
INPUT_PATH = SPEC_DIR / "TRACEABILITY.md"
OUTPUT_PATH = SPEC_DIR / "TRACEABILITY_REVERSE.md"

# プレフィックス → (表示名, ソート順)
PREFIX_INFO = {
    "BG": ("ビジネス目標", 1),
    "UC": ("ユースケース", 2),
    "FR": ("機能要求", 3),
    "QR": ("品質要求", 4),
    "CST": ("制約事項", 5),
    "PRC": ("前提条件", 6),
    "RD": ("要求定義セクション", 7),
    "RS": ("要件定義セクション", 8),
    "BD": ("基本設計セクション", 9),
    "DD": ("詳細設計セクション", 10),
}

COL_HEADERS = ("ID", "概要", "関連 ID", "関連概要", "備考")

PREFIX_RE = re.compile(r"^([A-Z]+)-")


def extract_prefix(id_str: str) -> str | None:
    """ID 文字列からプレフィックスを抽出する。"""
    m = PREFIX_RE.match(id_str)
    return m.group(1) if m else None


def parse_all_rows(text: str) -> list[tuple]:
    """TRACEABILITY.md のメインテーブルから全データ行を抽出する。"""
    end_sections = {"カバレッジ確認", "参照ドキュメント"}
    rows = []
    in_main_table = False

    for line in text.split("\n"):
        stripped = line.strip()

        # メインテーブル終了判定
        if stripped.startswith("##"):
            heading = stripped.lstrip("# ").strip()
            if any(heading.startswith(s) for s in end_sections):
                in_main_table = False
                continue

        # メインテーブルヘッダー検出
        if stripped.startswith("| ID |"):
            in_main_table = True
            continue

        # セパレータ行スキップ
        if stripped.startswith("|---"):
            continue

        if not in_main_table or not stripped.startswith("|"):
            continue

        cells = [c.strip() for c in stripped.split("|")]
        if cells and cells[0] == "":
            cells = cells[1:]
        if cells and cells[-1] == "":
            cells = cells[:-1]

        # グループ区切り行（全セル空）はスキップ
        if all(c == "" for c in cells):
            continue

        if len(cells) < 5:
            continue

        rows.append(tuple(cells[:5]))

    return rows


def reverse_and_group(rows: list[tuple]) -> dict[str, list[tuple]]:
    """行を逆転し、逆転後IDのプレフィックスでグルーピングする。"""
    groups: dict[str, list[tuple]] = defaultdict(list)

    for id_, desc_, rel_id, rel_desc, note in rows:
        if rel_id == "—":
            prefix = extract_prefix(id_)
            if prefix:
                groups[prefix].append((id_, desc_, "—", "—", note))
        else:
            prefix = extract_prefix(rel_id)
            if prefix:
                groups[prefix].append((rel_id, rel_desc, id_, desc_, note))

    for prefix in groups:
        groups[prefix].sort(key=lambda r: r[0])

    return groups


def format_output(groups: dict[str, list[tuple]]) -> str:
    """グループをMarkdown文字列に変換する。"""
    lines = ["# FlowRunner 逆引きトレーサビリティ", ""]

    sorted_prefixes = sorted(
        groups.keys(),
        key=lambda p: PREFIX_INFO.get(p, ("", 99))[1],
    )

    for i, prefix in enumerate(sorted_prefixes):
        info = PREFIX_INFO.get(prefix)
        display = f"{prefix}（{info[0]}）" if info else prefix

        lines.append("---")
        lines.append("")
        lines.append(f"## {i + 1}. {display}")
        lines.append("")
        lines.append(
            f"| {COL_HEADERS[0]} | {COL_HEADERS[1]} | {COL_HEADERS[2]}"
            f" | {COL_HEADERS[3]} | {COL_HEADERS[4]} |"
        )
        lines.append("|---|---|---|---|---|")

        for row in groups[prefix]:
            lines.append(f"| {row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]} |")

        lines.append("")

    return "\n".join(lines)


def main():
    if not INPUT_PATH.exists():
        print(f"❌ {INPUT_PATH} が見つかりません", file=sys.stderr)
        sys.exit(1)

    text = INPUT_PATH.read_text(encoding="utf-8")
    rows = parse_all_rows(text)

    if not rows:
        print("❌ パース可能なデータ行が見つかりません", file=sys.stderr)
        sys.exit(1)

    groups = reverse_and_group(rows)
    output = format_output(groups)

    OUTPUT_PATH.write_text(output, encoding="utf-8")

    total = sum(len(r) for r in groups.values())
    print(f"✅ {OUTPUT_PATH} を生成しました")
    print(f"   セクション数: {len(groups)}")
    print(f"   データ行数: {total}")


if __name__ == "__main__":
    main()
