"""Load packaged resources and apply additive project configuration."""

import hashlib
from importlib.resources import files
import json
from pathlib import Path
import re

from . import __version__
from .policy import validate_policy as validate_matrix


LANGUAGES = ("en", "zh-CN")
TEXT_FILES = (
    "AGENTS.md", "REVIEW.md", "ci/ai-review-prompt.md",
    "docs/ai-governance/engineering.md", "docs/ai-governance/SETUP.md",
)
SHARED_FILES = (
    "ci/commands.json", "ci/quality-policy.json",
    "ci/templates/github-checks.yml.example",
    "docs/ai-governance/LICENSE",
)


def parse_json(data):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON field: " + key)
            result[key] = value
        return result
    return json.loads(data, object_pairs_hook=unique)


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def validate_commands(config):
    if not isinstance(config, dict) or not config:
        raise ValueError("Commands must be a nonempty JSON object")
    for name, steps in config.items():
        if not isinstance(name, str) or not name:
            raise ValueError("Invalid check name")
        if steps is None:
            continue
        if not isinstance(steps, list) or not steps:
            raise ValueError("Use a nonempty list of argument arrays, or null: " + name)
        for argv in steps:
            if (not isinstance(argv, list) or not argv
                    or not all(isinstance(v, str) and v and "\0" not in v for v in argv)):
                raise ValueError("Invalid command arguments: " + name)


def validate_policy(policy):
    if not isinstance(policy, dict):
        raise ValueError("Policy must be a JSON object")
    validate_matrix(policy)


def validate_config(config):
    allowed = {"name", "commands", "high_risk_paths", "required_checks"}
    if not isinstance(config, dict) or not set(config) <= allowed:
        raise ValueError("Config accepts only: name, commands, high_risk_paths, required_checks")
    name = config.get("name", "custom")
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", name):
        raise ValueError("Config name must be 1–64 letters, digits, dots, underscores or hyphens")
    if "commands" in config:
        validate_commands(config["commands"])
    paths = config.get("high_risk_paths", [])
    if not isinstance(paths, list):
        raise ValueError("high_risk_paths must be a list of relative POSIX glob patterns")
    for path in paths:
        if (not isinstance(path, str) or not path or "\\" in path or "\0" in path
                or any(part in ("", ".", "..") for part in path.split("/"))):
            raise ValueError("Invalid high-risk path pattern")
    checks = config.get("required_checks", {})
    if not isinstance(checks, dict) or not set(checks) <= {"L0", "L1", "L2"}:
        raise ValueError("required_checks accepts only L0, L1 and L2")
    for names in checks.values():
        if (not isinstance(names, list) or not names
                or not all(isinstance(n, str) and n and "\0" not in n for n in names)
                or len(names) != len(set(names))):
            raise ValueError("Additional checks must be a nonempty list of unique names")


def bundle(language="en", config_path=None):
    if language not in LANGUAGES:
        raise ValueError("Unsupported template language")
    resources = files("agent_rulebook")
    data = resources.joinpath("data")
    output = {name: data.joinpath(language, *name.split("/")).read_bytes() for name in TEXT_FILES}
    output.update({name: data.joinpath("shared", *name.split("/")).read_bytes() for name in SHARED_FILES})
    # These standalone modules are also the implementation under package tests.
    # The target does not need Agent Rulebook installed to run its generated helpers.
    output["ci/quality_gate.py"] = resources.joinpath("policy.py").read_bytes()
    output["ci/run_check.py"] = resources.joinpath("runner.py").read_bytes()
    commands = parse_json(output["ci/commands.json"])
    policy = parse_json(output["ci/quality-policy.json"])
    profile = "default"
    if config_path:
        config = parse_json(Path(config_path).read_bytes())
        validate_config(config)
        profile = config.get("name", "custom")
        commands.update(config.get("commands", {}))
        for path in config.get("high_risk_paths", []):
            if path not in policy["high_risk_paths"]:
                policy["high_risk_paths"].append(path)
        extra = []
        for level in ("L0", "L1", "L2"):
            extra.extend(config.get("required_checks", {}).get(level, []))
            for name in extra:
                if name not in policy["required_checks"][level]:
                    policy["required_checks"][level].append(name)
    validate_commands(commands)
    validate_policy(policy)
    output["ci/commands.json"] = json_bytes(commands)
    output["ci/quality-policy.json"] = json_bytes(policy)
    output["ci/agent_rulebook.json"] = json_bytes({
        "version": __version__, "profile": profile, "language": language,
        "automation": "not-configured",
        "files": {name: hashlib.sha256(content).hexdigest() for name, content in sorted(output.items())},
    })
    return output, profile
