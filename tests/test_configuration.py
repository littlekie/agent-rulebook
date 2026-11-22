import json
from pathlib import Path
import tempfile
import unittest

from agent_rulebook import policy, runner
from agent_rulebook.templates import bundle, parse_json, validate_config


class ConfigurationTests(unittest.TestCase):
    def configured(self, config):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(json.dumps(config), encoding="utf-8")
            return bundle(config_path=path)

    def test_custom_requirements_are_cumulative_and_keep_defaults(self):
        original, _ = bundle()
        result, name = self.configured({
            "name": "my-service", "commands": {"contract": [["check-contracts"]]},
            "high_risk_paths": ["src/identity/*"],
            "required_checks": {"L0": ["docs"], "L1": ["contract"], "L2": ["recovery"]},
        })
        self.assertEqual("my-service", name)
        before = parse_json(original["ci/quality-policy.json"])
        after = parse_json(result["ci/quality-policy.json"])
        for level in ("L0", "L1", "L2"):
            self.assertTrue(set(before["required_checks"][level]) <= set(after["required_checks"][level]))
            self.assertIn("docs", after["required_checks"][level])
        self.assertNotIn("contract", after["required_checks"]["L0"])
        self.assertIn("contract", after["required_checks"]["L1"])
        self.assertIn("contract", after["required_checks"]["L2"])
        self.assertNotIn("recovery", after["required_checks"]["L1"])
        self.assertIn("recovery", after["required_checks"]["L2"])
        self.assertTrue(set(before["high_risk_paths"]) <= set(after["high_risk_paths"]))
        self.assertEqual("L2", policy.classify(after, [{"status": "modified", "path": "src/identity/a/b.py"}]))
        commands = parse_json(result["ci/commands.json"])
        self.assertIsNone(commands["unit"])
        self.assertEqual([["check-contracts"]], commands["contract"])

    def test_invalid_config_is_rejected(self):
        for config in ([], {"profile": "other"}, {"name": "../bad"},
                       {"low_risk_paths": ["*"]}, {"high_risk_paths": ["../x"]},
                       {"high_risk_paths": ["/x"]}, {"high_risk_paths": ["a\\b"]},
                       {"required_checks": {"L3": ["unit"]}},
                       {"required_checks": {"L1": []}},
                       {"required_checks": {"L1": ["unit", "unit"]}},
                       {"commands": {"unit": [["nul\0"]]}}):
            with self.subTest(config=config), self.assertRaises(ValueError):
                validate_config(config)

    def test_languages_share_policy_and_standalone_helpers(self):
        en, _ = bundle("en")
        zh, _ = bundle("zh-CN")
        self.assertEqual(set(en), set(zh))
        for name in ("ci/quality-policy.json", "ci/commands.json", "ci/quality_gate.py", "ci/run_check.py"):
            self.assertEqual(en[name], zh[name])
        self.assertIn("AI 开发规范", zh["AGENTS.md"].decode())
        self.assertIn(b"AI development", en["AGENTS.md"])
        self.assertEqual(Path(policy.__file__).read_bytes(), en["ci/quality_gate.py"])
        self.assertEqual(Path(runner.__file__).read_bytes(), en["ci/run_check.py"])

    def test_inventory_covers_every_generated_file_except_itself(self):
        import hashlib
        output, _ = bundle()
        inventory = parse_json(output["ci/agent_rulebook.json"])
        self.assertEqual("not-configured", inventory["automation"])
        self.assertEqual(set(output) - {"ci/agent_rulebook.json"}, set(inventory["files"]))
        for name, digest in inventory["files"].items():
            self.assertEqual(hashlib.sha256(output[name]).hexdigest(), digest)

    def test_unknown_language_is_rejected(self):
        with self.assertRaises(ValueError):
            bundle("unknown")

    def test_runner_rejects_duplicate_and_invalid_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "commands.json"
            for value in ('[]', '{', '{"unit":null,"unit":[["pass"]]}'):
                path.write_text(value)
                with self.subTest(value=value):
                    self.assertEqual(2, runner.run("unit", path))

    def test_runner_validates_all_steps_before_execution(self):
        import sys
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "executed"
            config = Path(directory) / "commands.json"
            config.write_text(json.dumps({"probe": [
                [sys.executable, "-c", "from pathlib import Path; import sys; Path(sys.argv[1]).touch()", str(marker)],
                ["bad\0argument"],
            ]}))
            self.assertEqual(2, runner.run("probe", config))
            self.assertFalse(marker.exists())


if __name__ == "__main__":
    unittest.main()
