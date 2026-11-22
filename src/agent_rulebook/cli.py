"""Initialize AI engineering rules and independent review policies in a repository."""

import argparse
import json
import sys

from . import __version__
from .filesystem import PROPOSALS, apply_plan, checked_path, plan, root_path
from .templates import LANGUAGES, bundle, parse_json, validate_commands, validate_policy


def initialize(args):
    root = root_path(args.target)
    output, profile = bundle(args.language, args.config)
    entries = plan(root, output)
    conflicts = [entry["path"] for entry in entries if entry["action"] == "conflict"]
    if args.apply and not conflicts:
        apply_plan(root, entries)
    return {
        "status": "conflict" if conflicts else ("initialized" if args.apply else "preview"),
        "target": str(root), "profile": profile, "language": args.language,
        "files": [{"path": entry["path"], "action": entry["action"]} for entry in entries],
        "proposals": [entry["path"] for entry in entries if entry["path"] in PROPOSALS.values()],
        "automation": "not-configured",
        "next": "Integrate proposal files, configure ci/commands.json, run doctor, then follow docs/ai-governance/SETUP.md.",
    }, 1 if conflicts else 0


def doctor(args):
    root = root_path(args.target)
    if not root.is_dir():
        raise ValueError("Target directory does not exist")
    issues = []
    for name in ("AGENTS.md", "REVIEW.md", "ci/ai-review-prompt.md", "ci/quality_gate.py",
                 "ci/run_check.py", "docs/ai-governance/engineering.md", "docs/ai-governance/SETUP.md"):
        path = checked_path(root, name)
        if not path.exists() or not path.read_bytes().strip():
            issues.append("Missing or empty file: " + name)
    for name in PROPOSALS.values():
        if checked_path(root, name).exists():
            issues.append("Integrate, then remove proposal: " + name)
    policy = parse_json(checked_path(root, "ci/quality-policy.json").read_bytes())
    commands = parse_json(checked_path(root, "ci/commands.json").read_bytes())
    validate_policy(policy)
    validate_commands(commands)
    needed = {"setup"} | {name for names in policy["required_checks"].values() for name in names}
    for name in sorted(needed):
        if commands.get(name) is None:
            issues.append("Unconfigured check (platform checks need a trusted adapter): " + name)
    return {
        "status": "needs-configuration" if issues else "local-config-valid",
        "target": str(root), "issues": issues, "automation": "not-verified",
        "checks_executed": False,
        "notice": "Local structure only. Project commands, model review, CI, rulesets and merge permissions were not verified.",
    }, 1 if issues else 0


def main(argv=None):
    # Preserve successful operations when redirected output uses a limited codec.
    # JSON is ASCII-safe below; human-readable paths may need escaped characters.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")
    parser = argparse.ArgumentParser(prog="agent-rulebook", description=__doc__)
    parser.add_argument("--version", action="version", version="agent-rulebook " + __version__)
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init", help="Preview files; use --apply to create them")
    init.add_argument("target", nargs="?", default=".")
    init.add_argument("--config", help="Project JSON configuration (read, never executed)")
    init.add_argument("--language", choices=LANGUAGES, default="en")
    init.add_argument("--apply", action="store_true")
    init.add_argument("--json", action="store_true")
    check = sub.add_parser("doctor", help="Read-only local configuration checks")
    check.add_argument("target", nargs="?", default=".")
    check.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    try:
        result, code = initialize(args) if args.command == "init" else doctor(args)
    except (OSError, ValueError, TypeError, KeyError) as error:
        result, code = {"status": "error", "message": str(error)}, 2
    if args.json:
        print(json.dumps(result, ensure_ascii=True, indent=2))
    else:
        print("Agent Rulebook · " + result["status"])
        for entry in result.get("files", []):
            print("  {action:9} {path}".format(**entry))
        for issue in result.get("issues", []):
            print("  - " + issue)
        for key in ("message", "next", "notice"):
            if key in result:
                print(result[key])
        if result.get("proposals"):
            print("Existing instructions were preserved; proposal files need integration.")
        if result.get("automation"):
            print("Automation: " + result["automation"])
    return code
