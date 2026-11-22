import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


from agent_rulebook import policy as gate, runner
from importlib.resources import files

CI = files("agent_rulebook").joinpath("data/shared/ci")
GATE = Path(gate.__file__)
RUNNER = Path(runner.__file__)


class QualityGateTests(unittest.TestCase):
    def setUp(self):
        self.policy = json.loads((CI / "quality-policy.json").read_text())
        self.context = {
            "repository": "example/project", "pr_number": 12,
            "head_sha": "a" * 40, "base_sha": "b" * 40, "tested_sha": "c" * 40,
            "policy_sha256": hashlib.sha256((CI / "quality-policy.json").read_bytes()).hexdigest(),
        }
        # Synthetic evidence for testing only; never submit this as CI proof.
        self.evidence = {
            "context": copy.deepcopy(self.context), "changes_complete": True,
            "changed_files": [{"path": "src/orders/service.py", "status": "modified"}],
            "checks": [{"name": name, "status": "success", "context": copy.deepcopy(self.context)}
                       for name in self.policy["required_checks"]["L2"]],
            "review": {
                "context": copy.deepcopy(self.context), "status": "complete",
                "minimum_risk": "L1", "coverage": "complete",
                "unresolved_questions": [], "findings": [],
            },
        }

    def result(self):
        return gate.evaluate(self.policy, self.context, self.evidence)

    def assert_hold(self):
        self.assertEqual("hold", self.result()["decision"])

    def test_l1_complete_evidence_is_eligible(self):
        self.assertEqual("eligible", self.result()["decision"])

    def test_l0_does_not_need_ai_review(self):
        self.evidence["changed_files"] = [{"path": "docs/usage/start.md", "status": "modified"}]
        self.evidence.pop("review")
        self.evidence["checks"] = self.evidence["checks"][:2]
        self.assertEqual(("L0", "eligible"), (self.result()["risk"], self.result()["decision"]))

    def test_unknown_path_is_not_low_risk(self):
        self.evidence["changed_files"][0]["path"] = "unknown/new.file"
        self.evidence.pop("review")
        self.assertEqual("L1", self.result()["risk"])
        self.assert_hold()

    def test_high_risk_path_cannot_be_downgraded_by_model(self):
        self.evidence["changed_files"][0]["path"] = ".github/workflows/check.yml"
        self.evidence["review"]["minimum_risk"] = "L0"
        self.assertEqual("L2", self.result()["risk"])
        self.assert_hold()

    def test_renamed_protected_file_remains_high_risk(self):
        self.evidence["changed_files"] = [{"status": "renamed", "path": "docs/usage/old.md", "previous_path": "ci/quality-policy.json"}]
        self.assertEqual("L2", self.result()["risk"])
        self.assert_hold()

    def test_deleted_protected_file_remains_high_risk(self):
        self.evidence["changed_files"] = [{"status": "removed", "path": "docs/business/rules.md"}]
        self.assertEqual("L2", self.result()["risk"])

    def test_missing_previous_path_is_invalid(self):
        self.evidence["changed_files"][0]["status"] = "renamed"
        with self.assertRaises(ValueError):
            self.result()

    def test_incomplete_diff_holds(self):
        self.evidence["changes_complete"] = False
        self.assert_hold()

    def test_missing_check_holds(self):
        self.evidence["checks"] = self.evidence["checks"][1:]
        self.assert_hold()

    def test_only_success_is_accepted(self):
        for status in ("skipped", "neutral", "failure", "cancelled", "timed_out", "pending", None):
            with self.subTest(status=status):
                self.evidence["checks"][0]["status"] = status
                self.assert_hold()

    def test_duplicate_checks_are_invalid(self):
        self.evidence["checks"].append(copy.deepcopy(self.evidence["checks"][0]))
        with self.assertRaises(ValueError):
            self.result()

    def test_stale_head_base_tested_and_policy_are_rejected(self):
        for field in ("head_sha", "base_sha", "tested_sha", "policy_sha256"):
            with self.subTest(field=field):
                self.evidence["checks"][0]["context"] = copy.deepcopy(self.context)
                self.evidence["checks"][0]["context"][field] = "d" * len(self.context[field])
                self.assert_hold()

    def test_stale_review_holds(self):
        self.evidence["review"]["context"]["head_sha"] = "e" * 40
        self.assert_hold()

    def test_stale_bundle_holds(self):
        self.evidence["context"]["base_sha"] = "e" * 40
        self.assert_hold()

    def test_missing_review_holds_l1(self):
        self.evidence.pop("review")
        self.assert_hold()

    def test_partial_review_holds(self):
        self.evidence["review"]["coverage"] = "partial"
        self.assert_hold()

    def test_unavailable_review_holds(self):
        self.evidence["review"]["status"] = "unavailable"
        self.assert_hold()

    def test_unresolved_questions_hold(self):
        self.evidence["review"]["unresolved_questions"] = ["退款规则未确认"]
        self.assert_hold()

    def test_blocking_findings_hold_but_suggestions_do_not(self):
        finding = {"blocking": True, "file": "src/orders/service.py", "line": 8,
                   "title": "重复提交", "trigger": "同一请求重试", "impact": "创建两条记录", "evidence": "缺少幂等约束"}
        self.evidence["review"]["findings"] = [finding]
        self.assert_hold()
        finding["blocking"] = False
        self.assertEqual("eligible", self.result()["decision"])

    def test_string_boolean_in_review_is_invalid(self):
        self.evidence["review"]["findings"] = [{"blocking": "false"}]
        with self.assertRaises(ValueError):
            self.result()

    def test_ai_upgrade_requires_extra_checks_and_human(self):
        self.evidence["review"]["minimum_risk"] = "L2"
        self.evidence["checks"] = self.evidence["checks"][:-2]
        result = self.result()
        self.assertEqual("L2", result["risk"])
        self.assertEqual(3, len(result["reasons"]))

    def test_l2_approval_must_be_current_and_authorized(self):
        self.evidence["declared_risk"] = "L2"
        self.assert_hold()
        approval = {"state": "approved", "authorized": True, "reviewer": "owner",
                    "context": copy.deepcopy(self.context)}
        self.evidence["human_approval"] = approval
        self.assertEqual("eligible", self.result()["decision"])
        approval["authorized"] = False
        self.assert_hold()
        approval["authorized"] = True
        approval["context"]["head_sha"] = "f" * 40
        self.assert_hold()

    def test_unsafe_paths_are_invalid(self):
        for path in ("../ci/x", "/ci/x", "ci/../x", "ci\\x", "ci//x"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.evidence["changed_files"][0]["path"] = path
                self.result()

    def test_cli_exit_codes_and_policy_binding(self):
        with tempfile.TemporaryDirectory() as directory:
            context = Path(directory) / "context.json"
            evidence = Path(directory) / "evidence.json"
            args = [sys.executable, str(GATE), "--policy", str(CI / "quality-policy.json"),
                    "--context", str(context), "--evidence", str(evidence)]
            context.write_text(json.dumps(self.context))
            evidence.write_text(json.dumps(self.evidence))
            self.assertEqual(0, subprocess.run(args, capture_output=True).returncode)
            self.evidence.pop("review")
            evidence.write_text(json.dumps(self.evidence))
            self.assertEqual(1, subprocess.run(args, capture_output=True).returncode)
            self.context["policy_sha256"] = "0" * 64
            context.write_text(json.dumps(self.context))
            self.assertEqual(2, subprocess.run(args, capture_output=True).returncode)

    def test_unconfigured_command_fails(self):
        result = subprocess.run([sys.executable, str(RUNNER), "unit", "--config", str(CI / "commands.json")], capture_output=True, text=True)
        self.assertEqual(2, result.returncode)
        self.assertIn("UNCONFIGURED", result.stderr)

    def test_unicode_check_with_ascii_stdout_returns_hold_json(self):
        for level in ("L1", "L2"):
            self.policy["required_checks"][level].append("契约检查")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            policy_path = root / "policy.json"
            policy_path.write_text(json.dumps(self.policy))
            self.context["policy_sha256"] = hashlib.sha256(policy_path.read_bytes()).hexdigest()
            self.evidence["context"] = copy.deepcopy(self.context)
            self.evidence["review"]["context"] = copy.deepcopy(self.context)
            for check in self.evidence["checks"]:
                check["context"] = copy.deepcopy(self.context)
            (root / "context.json").write_text(json.dumps(self.context))
            (root / "evidence.json").write_text(json.dumps(self.evidence))
            result = subprocess.run(
                [sys.executable, str(GATE), "--policy", str(policy_path),
                 "--context", str(root / "context.json"), "--evidence", str(root / "evidence.json")],
                capture_output=True, text=True, encoding="ascii",
                env=dict(os.environ, PYTHONIOENCODING="ascii"), timeout=20,
            )
            self.assertEqual(1, result.returncode, result.stderr)
            self.assertEqual("", result.stderr)
            data = json.loads(result.stdout)
            self.assertEqual("hold", data["decision"])
            self.assertIn("required check is not successful: 契约检查", data["reasons"])

    def test_unicode_unconfigured_check_with_ascii_stderr_keeps_exit_code(self):
        result = subprocess.run(
            [sys.executable, str(RUNNER), "契约检查", "--config", str(CI / "commands.json")],
            capture_output=True, text=True, encoding="ascii",
            env=dict(os.environ, PYTHONIOENCODING="ascii"), timeout=20,
        )
        self.assertEqual(2, result.returncode)
        self.assertIn("UNCONFIGURED", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_duplicate_json_keys_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            path.write_text('{"status":"failure","status":"success"}')
            with self.assertRaises(ValueError):
                gate.read_json(path)

    def test_runner_uses_selected_profile_without_shell_expansion(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "commands.json"
            literal = "literal;$(this-must-not-run)"
            path.write_text(json.dumps({"probe": [[sys.executable, "-c", "import sys; print(sys.argv[1])", literal]]}))
            result = subprocess.run([sys.executable, str(RUNNER), "probe", "--config", str(path)],
                                    capture_output=True, text=True)
            self.assertEqual(0, result.returncode)
            self.assertEqual(literal, result.stdout.strip())

    def test_runner_stops_after_a_failing_command(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "commands.json"
            path.write_text(json.dumps({"probe": [[sys.executable, "-c", "raise SystemExit(7)"],
                                                   [sys.executable, "-c", "print('must-not-run')"]]}))
            result = subprocess.run([sys.executable, str(RUNNER), "probe", "--config", str(path)],
                                    capture_output=True, text=True)
            self.assertEqual(1, result.returncode)
            self.assertNotIn("must-not-run", result.stdout)



if __name__ == "__main__":
    unittest.main()
