"""Check source syntax, text hygiene, JSON and package/resource contracts."""

import ast
from pathlib import Path
import re

from agent_rulebook import __version__
from agent_rulebook.templates import bundle, parse_json


ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {".git", ".venv", "build", "dist", "__pycache__"}


def main():
    count = 0
    for path in ROOT.rglob("*"):
        relative = path.relative_to(ROOT)
        if any(part in EXCLUDED or part.endswith(".egg-info") for part in relative.parts):
            continue
        if not path.is_file() or path.suffix not in {".py", ".json", ".md", ".toml", ".yml", ".example"}:
            continue
        data = path.read_bytes()
        source = data.decode("utf-8")
        assert b"\r" not in data and source.endswith("\n"), str(relative) + ": expected LF and final newline"
        assert all(line.rstrip() == line for line in source.splitlines()), str(relative) + ": trailing whitespace"
        if path.suffix == ".py":
            ast.parse(source, filename=str(relative))
        if path.suffix == ".json":
            parse_json(source)
        count += 1
    project = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert 'version = "' + __version__ + '"' in project, "package version mismatch"
    for language in ("en", "zh-CN"):
        output, _ = bundle(language)
        assert all(content.strip() for content in output.values()), "empty resource"
        assert output["docs/ai-governance/LICENSE"] == (ROOT / "LICENSE").read_bytes()
        for content in output.values():
            assert ("/" + "Users/").encode() not in content, "machine-specific resource"
    for path in [*ROOT.glob("*.md"), *ROOT.joinpath("docs").glob("*.md")]:
        for target in re.findall(r"\]\(([^)]+)\)", path.read_text(encoding="utf-8")):
            if "://" in target or target.startswith("#"):
                continue
            assert (path.parent / target.split("#")[0]).exists(), str(path) + ": broken link " + target
    print("Source checks passed (" + str(count) + " files; both template languages).")


if __name__ == "__main__":
    main()
