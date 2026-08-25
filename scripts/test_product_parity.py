#!/usr/bin/env python3
"""Parity gate for the dual-host product surface.

Adapted from ai-native-cowork's scripts/test_product_parity.py — the house
pattern for a plugin that ships to both Claude Code and Codex. The failure it
exists to prevent: one manifest is bumped and the other is not, so a host
installs a version that does not exist, or a skill is added on one side only.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_SKILLS = {"s-continue", "s-compact", "usage-view", "report-limit", "setup-statusline", "setup-git-lite"}
# Skills that read or write transcripts on BOTH hosts. The rest are Claude Code
# specific (statusline, dashboards, rate-limit reporting) and stay single-host.
DUAL_HOST_SKILLS = {"s-continue", "s-compact"}

skills = {path.parent.name for path in (ROOT / "skills").glob("*/SKILL.md")}
assert skills == EXPECTED_SKILLS, f"skill parity drift: {skills ^ EXPECTED_SKILLS}"

claude = json.loads((ROOT / ".claude-plugin" / "plugin.json").read_text())
codex = json.loads((ROOT / ".codex-plugin" / "plugin.json").read_text())
legacy = json.loads((ROOT / "manifest.json").read_text())

assert len({claude["name"], codex["name"], legacy["name"]}) == 1, "plugin name differs between manifests"
assert len({claude["version"], codex["version"], legacy["version"]}) == 1, (
    f"version drift: claude={claude['version']} codex={codex['version']} manifest={legacy['version']}"
)
assert codex["skills"] == "./skills/"

for name in sorted(EXPECTED_SKILLS):
    text = (ROOT / "skills" / name / "SKILL.md").read_text()
    assert text.startswith("---\n"), f"missing frontmatter: {name}"

# A dual-host skill must not hardcode one host's plugin-root variable: Codex
# does not always export CODEX_PLUGIN_ROOT and Claude Code never exports it, so
# a bare ${CLAUDE_PLUGIN_ROOT} in a command silently resolves to nothing.
for name in sorted(DUAL_HOST_SKILLS):
    text = (ROOT / "skills" / name / "SKILL.md").read_text()
    for line in text.splitlines():
        if line.lstrip().startswith("node ") and "PLUGIN_ROOT" in line:
            assert "${PLUGIN_ROOT}" in line, f"{name}: command hardcodes a host plugin root: {line.strip()}"
    assert "codex" in text.lower(), f"{name}: dual-host skill never mentions Codex"

codex_readmes = [ROOT / "README-CODEX.md", ROOT / "README-CODEX.ko.md", ROOT / "README-CODEX.ja.md", ROOT / "README-CODEX.zh-Hans.md"]
required_commands = {
    "codex plugin marketplace add ww-w-ai/marketplace",
    f"codex plugin add {codex['name']}@ww-w-ai",
    "codex plugin marketplace upgrade ww-w-ai",
    "codex plugin list",
}
for readme in codex_readmes:
    assert readme.exists(), f"missing Codex README: {readme.name}"
    missing = required_commands - set(readme.read_text().splitlines())
    assert not missing, f"Codex README command drift in {readme.name}: {sorted(missing)}"

print(f"parity passed: {len(EXPECTED_SKILLS)} skills, 3 manifests at {claude['version']}, {len(codex_readmes)} Codex READMEs")
