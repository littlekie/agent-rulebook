"""Install a wheel offline and exercise its CLI outside the source checkout."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import venv
import zipfile


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/smoke_wheel.py path/to/package.whl")
    wheel = Path(sys.argv[1]).resolve(strict=True)
    with zipfile.ZipFile(wheel) as archive:
        names = archive.namelist()
        for name in names:
            assert not any(p in {".git", ".venv", "__pycache__"} for p in name.split("/")), name
        assert "agent_rulebook/data/en/AGENTS.md" in names
        assert "agent_rulebook/data/zh-CN/AGENTS.md" in names
        assert "agent_rulebook/data/shared/docs/ai-governance/LICENSE" in names
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        environment = root / "env"
        venv.EnvBuilder(with_pip=True).create(environment)
        scripts = environment / ("Scripts" if os.name == "nt" else "bin")
        python = scripts / ("python.exe" if os.name == "nt" else "python")
        cli = scripts / ("agent-rulebook.exe" if os.name == "nt" else "agent-rulebook")
        env = dict(os.environ)
        env.pop("PYTHONPATH", None)
        env.pop("PYTHONHOME", None)
        env["PYTHONUTF8"] = "1"

        def run(args, expected=0):
            result = subprocess.run(list(map(str, args)), cwd=root, env=env,
                                    capture_output=True, text=True, encoding="utf-8", timeout=120)
            if result.returncode != expected:
                raise AssertionError(result.stdout + result.stderr)
            return result.stdout

        run([python, "-m", "pip", "install", "--no-index", "--no-deps", wheel])
        assert run([cli, "--version"]).startswith("agent-rulebook ")
        for language in ("en", "zh-CN"):
            target = root / ("project " + language)
            preview = json.loads(run([cli, "init", target, "--language", language, "--json"]))
            assert preview["status"] == "preview" and not target.exists()
            result = json.loads(run([cli, "init", target, "--language", language, "--apply", "--json"]))
            assert result["status"] == "initialized"
            repeat = json.loads(run([cli, "init", target, "--language", language, "--apply", "--json"]))
            assert all(item["action"] == "unchanged" for item in repeat["files"])
            doctor = json.loads(run([cli, "doctor", target, "--json"], expected=1))
            assert doctor["status"] == "needs-configuration" and doctor["checks_executed"] is False
            run([python, target / "ci/run_check.py", "unit"], expected=2)
        print("Wheel smoke passed: isolated install, installed CLI, both languages, repeat and doctor.")


if __name__ == "__main__":
    main()
