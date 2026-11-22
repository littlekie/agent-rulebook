import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


from agent_rulebook import filesystem as cli
from agent_rulebook.templates import bundle


class InitTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.workspace = Path(self.temp.name)
        self.target = self.workspace / "项目 with spaces"

    def run_cli(self, *args):
        process = subprocess.run(
            [sys.executable, "-m", "agent_rulebook", *map(str, args), "--json"],
            capture_output=True, text=True, encoding="utf-8", cwd=self.workspace, timeout=20,
        )
        self.assertEqual("", process.stderr, process.stderr)
        return process.returncode, json.loads(process.stdout)

    def initialize(self, *args):
        code, result = self.run_cli("init", self.target, "--apply", *args)
        self.assertEqual(0, code, result)
        return result

    def snapshot(self):
        return {p.relative_to(self.target).as_posix(): (p.read_bytes(), p.stat().st_mtime_ns)
                for p in self.target.rglob("*") if p.is_file()}

    def test_preview_creates_nothing(self):
        code, result = self.run_cli("init", self.target)
        self.assertEqual((0, "preview"), (code, result["status"]))
        self.assertFalse(self.target.exists())

    def test_unicode_target_with_ascii_stdout_still_returns_valid_json(self):
        environment = dict(os.environ, PYTHONIOENCODING="ascii")
        process = subprocess.run(
            [sys.executable, "-m", "agent_rulebook", "init", str(self.target), "--apply", "--json"],
            cwd=self.workspace, env=environment, capture_output=True, text=True,
            encoding="ascii", timeout=20,
        )
        self.assertEqual(0, process.returncode, process.stderr)
        result = json.loads(process.stdout)
        self.assertEqual("initialized", result["status"])
        self.assertEqual(str(self.target.resolve()), result["target"])
        self.assertTrue((self.target / "AGENTS.md").exists())

    def test_unicode_error_with_ascii_stdout_has_no_traceback(self):
        self.target.write_text("not a directory")
        process = subprocess.run(
            [sys.executable, "-m", "agent_rulebook", "init", str(self.target)],
            cwd=self.workspace, env=dict(os.environ, PYTHONIOENCODING="ascii"),
            capture_output=True, text=True, encoding="ascii", timeout=20,
        )
        self.assertEqual(2, process.returncode)
        self.assertEqual("", process.stderr)
        self.assertIn("Target is not a directory", process.stdout)

    def test_initialize_preserves_policy_and_does_not_activate_workflow(self):
        self.initialize()
        self.assertFalse((self.target / ".github").exists())
        policy = json.loads((self.target / "ci/quality-policy.json").read_text())
        self.assertIn("REVIEW.md", policy["high_risk_paths"])
        self.assertIn("security", policy["required_checks"]["L1"])
        self.assertIn("risk-validation", policy["required_checks"]["L2"])
        self.assertTrue((self.target / "docs/ai-governance/LICENSE").is_file())

    def test_repeat_is_byte_and_mtime_identical(self):
        self.initialize()
        before = self.snapshot()
        result = self.initialize()
        self.assertEqual(before, self.snapshot())
        self.assertTrue(all(e["action"] == "unchanged" for e in result["files"]))

    def test_existing_instructions_become_proposals(self):
        self.target.mkdir()
        for name in ("AGENTS.md", "REVIEW.md"):
            (self.target / name).write_bytes(b"existing rules\r\n")
        result = self.initialize()
        self.assertEqual(2, len(result["proposals"]))
        for name in ("AGENTS.md", "REVIEW.md"):
            self.assertEqual(b"existing rules\r\n", (self.target / name).read_bytes())
        before = self.snapshot()
        self.initialize()
        self.assertEqual(before, self.snapshot())
        code, result = self.run_cli("doctor", self.target)
        self.assertEqual(1, code)
        self.assertTrue(any("proposal" in issue for issue in result["issues"]))

    def test_any_conflict_prevents_all_writes(self):
        (self.target / "ci").mkdir(parents=True)
        (self.target / "ci/commands.json").write_text('{"custom": null}')
        before = self.snapshot()
        code, result = self.run_cli("init", self.target, "--apply")
        self.assertEqual((1, "conflict"), (code, result["status"]))
        self.assertEqual(before, self.snapshot())

    def test_customized_file_is_not_overwritten_on_repeat(self):
        self.initialize()
        (self.target / "ci/commands.json").write_text('{"custom": null}')
        before = self.snapshot()
        code, _ = self.run_cli("init", self.target, "--apply")
        self.assertEqual(1, code)
        self.assertEqual(before, self.snapshot())

    def test_symlink_files_and_directories_are_rejected(self):
        self.target.mkdir()
        outside = self.workspace / "outside"
        outside.mkdir()
        (outside / "rules").write_text("keep")
        for relative, destination in (("ci", outside), ("AGENTS.md", outside / "rules")):
            with self.subTest(relative=relative):
                link = self.target / relative
                try:
                    link.symlink_to(destination, target_is_directory=destination.is_dir())
                except OSError as error:
                    self.skipTest("Symlink capability unavailable: " + str(error))
                code, result = self.run_cli("init", self.target, "--apply")
                self.assertEqual((2, "error"), (code, result["status"]))
                self.assertEqual("keep", (outside / "rules").read_text())
                self.assertEqual([link], list(self.target.iterdir()))
                link.unlink()

    def test_file_in_place_of_parent_directory_is_rejected(self):
        self.target.mkdir()
        (self.target / "ci").write_text("keep")
        code, _ = self.run_cli("init", self.target, "--apply")
        self.assertEqual(2, code)
        self.assertEqual([self.target / "ci"], list(self.target.iterdir()))

    def test_custom_commands_copied_but_never_executed(self):
        commands = self.workspace / "commands.json"
        marker = self.workspace / "executed"
        config = {"setup": [[sys.executable, "-c", "raise SystemExit('must not execute')"]],
                  "lint": [["touch", str(marker)]]}
        commands.write_text(json.dumps({"commands": config}))
        self.initialize("--config", commands)
        self.assertEqual(config, {k: v for k, v in json.loads((self.target / "ci/commands.json").read_text()).items() if k in config})
        self.run_cli("doctor", self.target)
        self.assertFalse(marker.exists())

    def test_malformed_commands_rejected_before_writing(self):
        commands = self.workspace / "commands.json"
        for data in ('{"lint":"npm run lint"}', '{"lint":[]}',
                     '{"lint":[[""]]}', '{"lint":null,"lint":null}', '[]'):
            with self.subTest(data=data):
                commands.write_text('{"commands":' + data + '}')
                code, _ = self.run_cli("init", self.target, "--apply", "--config", commands)
                self.assertEqual(2, code)
                self.assertFalse(self.target.exists())

    def test_doctor_reports_unconfigured_without_mutating(self):
        self.initialize()
        before = self.snapshot()
        code, result = self.run_cli("doctor", self.target)
        self.assertEqual((1, "needs-configuration"), (code, result["status"]))
        self.assertFalse(result["checks_executed"])
        self.assertEqual("not-verified", result["automation"])
        self.assertEqual(before, self.snapshot())

    def test_doctor_valid_configuration_does_not_claim_executed_checks(self):
        self.initialize()
        policy = json.loads((self.target / "ci/quality-policy.json").read_text())
        names = {"setup"} | set(policy["required_checks"]["L2"])
        config = {name: [["nonexistent-executable"]] for name in names}
        (self.target / "ci/commands.json").write_text(json.dumps(config))
        code, result = self.run_cli("doctor", self.target)
        self.assertEqual((0, "local-config-valid"), (code, result["status"]))
        self.assertEqual("not-verified", result["automation"])
        self.assertFalse(result["checks_executed"])

    def test_doctor_never_imports_target_python(self):
        self.initialize()
        (self.target / "ci/quality_gate.py").write_text("raise RuntimeError('untrusted execution')")
        code, result = self.run_cli("doctor", self.target)
        self.assertEqual(1, code, result)

    def test_doctor_rejects_corrupt_policy_and_missing_target(self):
        code, _ = self.run_cli("doctor", self.target)
        self.assertEqual(2, code)
        self.initialize()
        (self.target / "ci/quality-policy.json").write_text("[]")
        code, _ = self.run_cli("doctor", self.target)
        self.assertEqual(2, code)

    def test_partial_write_failure_removes_our_files_only(self):
        self.target.mkdir()
        keep = self.target / "keep.txt"
        keep.write_text("keep")
        entries = cli.plan(self.target, {"a": b"new", "b": b"new"})
        original = Path.open

        def fail_second(path, *args, **kwargs):
            if path.name == "b" and args and args[0] == "xb":
                raise OSError("simulated disk failure")
            return original(path, *args, **kwargs)

        with patch.object(Path, "open", fail_second), self.assertRaises(OSError):
            cli.apply_plan(self.target, entries)
        self.assertEqual([keep], list(self.target.iterdir()))

    def test_change_between_plan_and_apply_is_preserved(self):
        self.target.mkdir()
        entries = cli.plan(self.target, {"a": b"new", "b": b"new"})
        (self.target / "b").write_bytes(b"someone else's work")
        with self.assertRaises(ValueError):
            cli.apply_plan(self.target, entries)
        self.assertFalse((self.target / "a").exists())
        self.assertEqual(b"someone else's work", (self.target / "b").read_bytes())

    def test_rollback_preserves_edits_after_file_creation(self):
        self.target.mkdir()
        entries = cli.plan(self.target, {"a": b"new", "b": b"new"})
        original = Path.open

        def edit_then_fail(path, *args, **kwargs):
            if path.name == "b" and args and args[0] == "xb":
                (self.target / "a").write_bytes(b"concurrent edit")
                raise OSError("simulated disk failure")
            return original(path, *args, **kwargs)

        with patch.object(Path, "open", edit_then_fail), self.assertRaisesRegex(OSError, "retained"):
            cli.apply_plan(self.target, entries)
        self.assertEqual(b"concurrent edit", (self.target / "a").read_bytes())

    def test_partial_file_is_cleaned_after_short_write_failure(self):
        self.target.mkdir()
        entries = cli.plan(self.target, {"a": b"abcdef"})
        original = Path.open

        class ShortWriter:
            def __init__(self, stream):
                self.stream = stream
                self.called = False

            def __enter__(self):
                return self

            def __exit__(self, *args):
                self.stream.close()

            def fileno(self):
                return self.stream.fileno()

            def write(self, data):
                if self.called:
                    raise OSError("simulated disk full")
                self.called = True
                return self.stream.write(data[:2])

        def short_writer(path, *args, **kwargs):
            stream = original(path, *args, **kwargs)
            return ShortWriter(stream) if args and args[0] == "xb" else stream

        with patch.object(Path, "open", short_writer), self.assertRaises(OSError):
            cli.apply_plan(self.target, entries)
        self.assertFalse((self.target / "a").exists())



if __name__ == "__main__":
    unittest.main()
