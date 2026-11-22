# Copyright (c) 2026 Agent Rulebook contributors. MIT license.
# Generated copies include docs/ai-governance/LICENSE.
"""Unprivileged worker entrypoint. Unconfigured checks fail, never silently skip."""

import argparse
import json
from pathlib import Path
import subprocess
import sys


def run(name, config_path):
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(errors="backslashreplace")

    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON field: " + key)
            result[key] = value
        return result

    try:
        config = json.loads(Path(config_path).read_text(encoding="utf-8"), object_pairs_hook=unique)
        if not isinstance(config, dict):
            raise ValueError("Commands must be an object")
    except (OSError, ValueError) as error:
        print("INVALID CONFIG: " + str(error), file=sys.stderr)
        return 2
    steps = config.get(name)
    if not isinstance(steps, list) or not steps:
        print("UNCONFIGURED: " + name, file=sys.stderr)
        return 2
    # Validate all steps before any command has a chance to run.
    for argv in steps:
        if (not isinstance(argv, list) or not argv
                or not all(isinstance(x, str) and x and "\0" not in x for x in argv)):
            print("INVALID COMMAND: " + name, file=sys.stderr)
            return 2
    for argv in steps:
        try:
            subprocess.run(argv, check=True, timeout=600)
        except (OSError, subprocess.SubprocessError) as error:
            print(str(error), file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name")
    parser.add_argument("--config", default=Path(__file__).with_name("commands.json"))
    args = parser.parse_args()
    sys.exit(run(args.name, args.config))
