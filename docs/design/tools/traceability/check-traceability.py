#!/usr/bin/env python3
"""TRACEABILITY.md の整合性チェックスクリプト。

チェック内容:
1. ソースドキュメントに存在するセクション ID が TRACEABILITY の ID 列に登録されているか（漏れ検出）
2. TRACEABILITY に記載されたセクション ID がソースドキュメントに実在するか（ゴミ検出）
3. FR-00001〜FR-00015 の全件カバレッジ確認
4. テーブル構造の整合性チェック（列数統一）
5. DD→DDUT / BD→BDIT / RS→RSST テストカバレッジチェック（設計セクションに対応するテスト ID が存在するか）
6. RS→BD / BD→DD 下位工程分解網羅性チェック（上位セクションが下位工程で参照されているか）

使い方:
    python3 tools/traceability/check-traceability.py
"""

import re
import sys
from pathlib import Path

# ============================================================
# 設定
# ============================================================

SPEC_DIR = Path("docs/spec")
TRACEABILITY_PATH = SPEC_DIR / "TRACEABILITY.md"
TEST_DIR = Path("src/test")

# セクション ID を抽出するドキュメントディレクトリ一覧
# 各ディレクトリを GLOB で検出し、プレフィックス（RD-01, RS-01 等）をキーに管理する
SPEC_DIRS = [
    (SPEC_DIR / "01_RD", r"(RD-\d{2})"),
    (SPEC_DIR / "02_RS", r"(RS-\d{2})"),
    (SPEC_DIR / "03_BD", r"(BD-\d{2})"),
    (SPEC_DIR / "04_DD", r"(DD-\d{2})"),
]

# セクション ID パターン: (XX-NN-NNNNNN)
SECTION_ID_RE = re.compile(r"\(([A-Z]{2}-\d{2}-\d{6})\)")

# プレフィックスごとの ID パターン（全種別）
PREFIXED_ID_RE = re.compile(
    r"(BDIT-\d{2}-\d{6}-\d{5}|DDUT-\d{2}-\d{6}-\d{5}|RSST-\d{2}-\d{6}-\d{5}|"
    r"BG-\d{5}|UC-(?:F)?\d{5}|FR-(?:F)?\d{5}|QR-\d{5}|CST-\d{5}|PRC-\d{5}|"
    r"\b[A-Z]{2}-\d{2}-\d{6})"
)

# コア FR の範囲
CORE_FR_IDS = {f"FR-{i:05d}" for i in range(1, 16)}

# メインテーブル終了を示すセクション見出し
END_SECTIONS = {"カバレッジ確認", "参照ドキュメント", "横断依存マトリクス"}


# ============================================================
# ソースドキュメントからセクション ID を抽出
# ============================================================

def extract_section_ids(filepath: Path) -> set[str]:
    """ドキュメントの見出しからセクション ID を抽出する。"""
    ids = set()
    if not filepath.exists():
        return ids
    text = filepath.read_text(encoding="utf-8")
    for match in SECTION_ID_RE.finditer(text):
        ids.add(match.group(1))
    return ids


def find_docs(spec_dir: Path, prefix_pattern: str) -> dict[str, Path]:
    """指定ディレクトリからドキュメントを動的に検出する。"""
    docs = {}
    if not spec_dir.exists():
        return docs
    for md_file in sorted(spec_dir.rglob("*.md")):
        prefix_match = re.match(prefix_pattern, md_file.stem)
        if prefix_match:
            docs[prefix_match.group(1)] = md_file
    return docs


# ============================================================
# TRACEABILITY.md からデータ抽出
# ============================================================

def extract_traceability_data(
    filepath: Path,
) -> tuple[set[str], set[str], list[str]]:
    """TRACEABILITY.md のメインテーブルから ID を抽出する。

    Returns:
        (col1のID集合, テーブル内の全ID集合, エラーリスト)
    """
    col1_ids: set[str] = set()
    all_ids: set[str] = set()
    errors: list[str] = []

    if not filepath.exists():
        errors.append(f"❌ {filepath} が見つかりません")
        return col1_ids, all_ids, errors

    text = filepath.read_text(encoding="utf-8")
    in_main_table = False
    expected_cols = 5

    for line_num, line in enumerate(text.split("\n"), 1):
        stripped = line.strip()

        # メインテーブル終了判定（カバレッジ確認・参照ドキュメント見出し）
        if stripped.startswith("##"):
            heading = stripped.lstrip("# ").strip()
            if any(heading.startswith(s) for s in END_SECTIONS):
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
        # 先頭末尾の空要素を除去
        if cells and cells[0] == "":
            cells = cells[1:]
        if cells and cells[-1] == "":
            cells = cells[:-1]

        # グループ区切り行（全セル空）はスキップ
        if all(c == "" for c in cells):
            continue

        # 列数チェック
        if len(cells) != expected_cols:
            errors.append(
                f"⚠️  L{line_num}: 列数不一致 (期待 {expected_cols}, 実際 {len(cells)})"
            )
            continue

        # col1 の ID を収集
        col1 = cells[0]
        if col1 and col1 != "—":
            for m in PREFIXED_ID_RE.finditer(col1):
                col1_ids.add(m.group(1))

        # 全セルから ID を収集
        for cell in cells:
            for m in PREFIXED_ID_RE.finditer(cell):
                all_ids.add(m.group(1))

    return col1_ids, all_ids, errors


# ============================================================
# チェックロジック
# ============================================================

def check_section_id_coverage(
    source_ids: dict[str, set[str]],
    all_ids: set[str],
) -> list[str]:
    """ソースドキュメントのセクション ID が TRACEABILITY に登録されているか。"""
    issues = []
    for doc_id, ids in sorted(source_ids.items()):
        for sid in sorted(ids):
            if sid not in all_ids:
                issues.append(f"⚠️  {sid} ({doc_id}) が TRACEABILITY に未登録")
    return issues


def check_stale_references(
    source_ids: dict[str, set[str]],
    all_ids: set[str],
) -> list[str]:
    """TRACEABILITY に記載されているが、ソースに存在しないセクション ID。"""
    all_source_ids: set[str] = set()
    for ids in source_ids.values():
        all_source_ids.update(ids)

    issues = []
    for tid in sorted(all_ids):
        # セクション ID のみチェック（XX-NN-NNNNNN 形式）
        if re.match(r"[A-Z]{2}-\d{2}-\d{6}$", tid):
            if tid not in all_source_ids:
                issues.append(
                    f"❌ {tid} は TRACEABILITY に記載されているがソースに存在しない"
                )
    return issues


def check_fr_coverage(all_ids: set[str]) -> list[str]:
    """全コア FR が TRACEABILITY に含まれているか。"""
    issues = []
    for fr in sorted(CORE_FR_IDS):
        if fr not in all_ids:
            issues.append(f"❌ {fr} が TRACEABILITY に未登録")
    return issues


def find_self_contained_entries(filepath: Path) -> list[str]:
    """関連 ID が「—」のエントリを検出する（情報表示用）。"""
    entries = []
    if not filepath.exists():
        return entries
    text = filepath.read_text(encoding="utf-8")
    in_main_table = False

    for line in text.split("\n"):
        stripped = line.strip()

        if stripped.startswith("##"):
            heading = stripped.lstrip("# ").strip()
            if any(heading.startswith(s) for s in END_SECTIONS):
                in_main_table = False
                continue

        if stripped.startswith("| ID |"):
            in_main_table = True
            continue

        if stripped.startswith("|---"):
            continue

        if not in_main_table or not stripped.startswith("|"):
            continue

        cells = [c.strip() for c in stripped.split("|")]
        if cells and cells[0] == "":
            cells = cells[1:]
        if cells and cells[-1] == "":
            cells = cells[:-1]

        if all(c == "" for c in cells):
            continue

        if len(cells) >= 5:
            col1 = cells[0]
            col3 = cells[2]  # 関連 ID 列
            note = cells[4]
            if col1 and col1 != "—" and col3 == "—":
                entries.append(f"ℹ️  {col1}: RS 対応なし ({note})")

    return entries


# ============================================================
# 下位工程への分解網羅性チェック（RS→BD / BD→DD）
# ============================================================

def extract_traceability_references(
    filepath: Path,
) -> dict[str, set[str]]:
    """TRACEABILITY.md から col1(ID)→col3(関連ID) の順引きマップを構築する。

    Returns:
        ID列のセクションID → {関連ID列のセクションIDの集合}
        例: {"RS-01-003001": {"BD-01-002001", "BD-01-002002"}}
    """
    forward_map: dict[str, set[str]] = {}
    if not filepath.exists():
        return forward_map

    text = filepath.read_text(encoding="utf-8")
    in_main_table = False
    section_id_pattern = re.compile(r"[A-Z]{2}-\d{2}-\d{6}")

    for line in text.split("\n"):
        stripped = line.strip()

        if stripped.startswith("##"):
            heading = stripped.lstrip("# ").strip()
            if any(heading.startswith(s) for s in END_SECTIONS):
                in_main_table = False
                continue

        if stripped.startswith("| ID |"):
            in_main_table = True
            continue

        if stripped.startswith("|---"):
            continue

        if not in_main_table or not stripped.startswith("|"):
            continue

        cells = [c.strip() for c in stripped.split("|")]
        if cells and cells[0] == "":
            cells = cells[1:]
        if cells and cells[-1] == "":
            cells = cells[:-1]

        if all(c == "" for c in cells):
            continue

        if len(cells) < 5:
            continue

        col1 = cells[0]  # ID 列
        col3 = cells[2]  # 関連 ID 列

        col1_matches = section_id_pattern.findall(col1)
        col3_matches = section_id_pattern.findall(col3)

        for src_id in col1_matches:
            if col3_matches:
                for ref_id in col3_matches:
                    forward_map.setdefault(src_id, set()).add(ref_id)
            elif col3 == "—" or col3 == "\u2014":
                # 「—」は DD 分解対象外を示す明示的な除外エントリ
                forward_map.setdefault(src_id, set()).add("—")

    return forward_map


def check_decomposition_coverage(
    source_ids: dict[str, set[str]],
    forward_map: dict[str, set[str]],
) -> list[str]:
    """上位工程の各セクションが下位工程へ分解されているか検証する。

    TRACEABILITY.md の ID列(col1) に上位工程 ID があり、
    関連ID列(col3) に下位工程 ID が紐付いていることを確認する。

    チェック対象:
        RS-XX → BD-XX
        BD-XX → DD-XX
    """
    issues: list[str] = []

    coverage_pairs = [
        ("RS", "BD"),
        ("BD", "DD"),
    ]

    for upper_prefix, lower_prefix in coverage_pairs:
        for doc_id, section_ids in sorted(source_ids.items()):
            if not doc_id.startswith(upper_prefix + "-"):
                continue
            for sid in sorted(section_ids):
                refs = forward_map.get(sid, set())
                # 「—」マーカーは明示的な除外（DD分解対象外）を示す
                has_lower_ref = any(
                    r.startswith(lower_prefix + "-") or r == "—"
                    for r in refs
                )
                if not has_lower_ref:
                    issues.append(
                        f"⚠️  {sid} ({doc_id}) が {lower_prefix} で未分解"
                    )

    return issues


# ============================================================
# テストカバレッジチェック（DD→DDUT / BD→BDIT / RS→RSST）
# ============================================================

# テスト ID パターン: DDUT-XX-NNNNNN-NNNNN, BDIT-XX-NNNNNN-NNNNN, RSST-XX-NNNNNN-NNNNN
TEST_ID_RE = re.compile(
    r"(DDUT-\d{2}-\d{6}-\d{5}|BDIT-\d{2}-\d{6}-\d{5}|RSST-\d{2}-\d{6}-\d{5})"
)

# テスト ID → 設計セクション ID の対応
# DDUT-01-003004-00001 → DD-01-003004
# BDIT-04-002002-00001 → BD-04-002002
# RSST-02-004002-00001 → RS-02-004002
TEST_PREFIX_MAP = {
    "DDUT": "DD",
    "BDIT": "BD",
    "RSST": "RS",
}


def extract_test_ids_from_code(test_dir: Path) -> set[str]:
    """テストコード（src/test/）からテスト ID を抽出する。"""
    test_ids: set[str] = set()
    if not test_dir.exists():
        return test_ids
    for ts_file in sorted(list(test_dir.rglob("*.ts")) + list(test_dir.rglob("*.tsx"))):
        text = ts_file.read_text(encoding="utf-8")
        for match in TEST_ID_RE.finditer(text):
            test_ids.add(match.group(1))
    return test_ids


def test_id_to_section_id(test_id: str) -> str:
    """テスト ID から対応する設計セクション ID を導出する。

    例: DDUT-01-003004-00001 → DD-01-003004
    """
    parts = test_id.split("-")
    # parts: ['DDUT', '01', '003004', '00001']
    prefix = parts[0]
    design_prefix = TEST_PREFIX_MAP.get(prefix, prefix)
    return f"{design_prefix}-{parts[1]}-{parts[2]}"


def check_test_coverage(
    source_ids: dict[str, set[str]],
    test_ids: set[str],
) -> tuple[list[str], list[str]]:
    """各設計セクション ID に対応するテスト ID が 1 件以上あるか検証する。

    Returns:
        (issues: エラーリスト, info: 情報リスト)
    """
    # テスト ID から、テスト済みセクション ID の集合を構築
    tested_sections: set[str] = set()
    for tid in test_ids:
        tested_sections.add(test_id_to_section_id(tid))

    issues: list[str] = []
    info: list[str] = []

    # 対応テーブル: 設計工程 → テスト種別
    coverage_map = {
        "DD": "DDUT",
        "BD": "BDIT",
        "RS": "RSST",
    }

    for doc_id, section_ids in sorted(source_ids.items()):
        # doc_id: "DD-01", "BD-03", "RS-01" 等
        design_prefix = doc_id.split("-")[0]  # "DD", "BD", "RS"
        test_prefix = coverage_map.get(design_prefix)
        if not test_prefix:
            continue  # RD 等はテスト対象外

        for sid in sorted(section_ids):
            if sid not in tested_sections:
                issues.append(
                    f"⚠️  {sid} ({doc_id}) に対応する {test_prefix} テストが未作成"
                )

    return issues, info


# ============================================================
# メイン
# ============================================================

def main():
    print("🔍 TRACEABILITY.md 整合性チェック")
    print("=" * 50)

    # 1. ソースドキュメントからセクション ID 抽出
    source_ids: dict[str, set[str]] = {}
    for spec_dir, prefix_pattern in SPEC_DIRS:
        docs = find_docs(spec_dir, prefix_pattern)
        for doc_id, path in sorted(docs.items()):
            ids = extract_section_ids(path)
            if ids:
                source_ids[doc_id] = ids
                print(f"  📄 {doc_id}: {len(ids)} セクション ID")
            else:
                print(f"  ⚠️  {doc_id}: セクション ID なし ({path})")

    total_source = sum(len(ids) for ids in source_ids.values())
    print(f"\n  合計: {total_source} セクション ID（{len(source_ids)} ドキュメント）")
    print()

    # 2. TRACEABILITY.md から ID 抽出
    col1_ids, all_ids, structure_errors = extract_traceability_data(
        TRACEABILITY_PATH
    )
    print(f"  📋 TRACEABILITY.md: ID列 {len(col1_ids)} ID, 全体 {len(all_ids)} ID")
    print()

    # 3. チェック実行
    all_issues: list[str] = []

    # 構造エラー
    if structure_errors:
        print("### テーブル構造")
        for err in structure_errors:
            print(f"  {err}")
        all_issues.extend(structure_errors)
        print()

    # セクション ID カバレッジ
    coverage_issues = check_section_id_coverage(source_ids, all_ids)
    print("### セクション ID カバレッジ")
    if coverage_issues:
        for issue in coverage_issues:
            print(f"  {issue}")
        all_issues.extend(coverage_issues)
    else:
        print("  ✅ 問題なし")
    print()

    # ゴミ参照
    stale_issues = check_stale_references(source_ids, all_ids)
    print("### ゴミ参照（ソースに存在しない ID）")
    if stale_issues:
        for issue in stale_issues:
            print(f"  {issue}")
        all_issues.extend(stale_issues)
    else:
        print("  ✅ 問題なし")
    print()

    # FR カバレッジ
    fr_issues = check_fr_coverage(all_ids)
    print("### FR カバレッジ（FR-00001〜FR-00015）")
    if fr_issues:
        for issue in fr_issues:
            print(f"  {issue}")
        all_issues.extend(fr_issues)
    else:
        print("  ✅ 全 15 FR カバー済")
    print()

    # RS 対応なしエントリ（「—」パターン）
    self_contained = find_self_contained_entries(TRACEABILITY_PATH)
    if self_contained:
        print("### RS 対応なしエントリ（「—」パターン）")
        for entry in self_contained:
            print(f"  {entry}")
        print()

    # 下位工程への分解網羅性チェック（RS→BD / BD→DD）
    forward_map = extract_traceability_references(TRACEABILITY_PATH)
    decomp_issues = check_decomposition_coverage(source_ids, forward_map)
    print("### 下位工程分解網羅性（RS→BD / BD→DD）")
    if decomp_issues:
        for issue in decomp_issues:
            print(f"  {issue}")
        all_issues.extend(decomp_issues)
    else:
        print("  ✅ 全セクションが下位工程で参照済")
    print()

    # テストカバレッジチェック（DD→DDUT / BD→BDIT / RS→RSST）
    test_ids = extract_test_ids_from_code(TEST_DIR)
    print(f"  🧪 テストコードから {len(test_ids)} テスト ID を抽出")
    print()

    test_coverage_issues, test_coverage_info = check_test_coverage(
        source_ids, test_ids
    )
    print("### テストカバレッジ（DD→DDUT / BD→BDIT / RS→RSST）")
    if test_coverage_issues:
        for issue in test_coverage_issues:
            print(f"  {issue}")
        all_issues.extend(test_coverage_issues)
    else:
        print("  ✅ 全設計セクションにテストあり")
    print()

    # サマリ
    print("=" * 50)
    if all_issues:
        print(f"⚠️  {len(all_issues)} 件の問題が見つかりました")
        sys.exit(1)
    else:
        print("✅ 全チェック OK")
        sys.exit(0)


if __name__ == "__main__":
    main()
