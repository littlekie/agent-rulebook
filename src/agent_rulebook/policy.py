# Copyright (c) 2026 Agent Rulebook contributors. MIT license.
# Generated copies include docs/ai-governance/LICENSE.
"""Deterministic decision core; input authenticity MUST be verified by a controller.

No GitHub API calls, model calls, approvals, or merges are performed here.
Run with Python 3.10+: quality_gate.py --policy FILE --context FILE --evidence FILE
Exit 0: eligible under policy; 1: hold; 2: invalid input/configuration.
"""

import argparse
import fnmatch
import hashlib
import json
from pathlib import Path
import re
import sys


LEVELS = ("L0", "L1", "L2")
CONTEXT_FIELDS = {"repository", "pr_number", "head_sha", "base_sha", "tested_sha", "policy_sha256"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def valid_path(path):
    require(isinstance(path, str) and bool(path), "invalid file path")
    require(not path.startswith("/") and "\\" not in path, "path must be relative POSIX")
    require(all(part not in ("", ".", "..") for part in path.split("/")), "unsafe file path")
    return path


def validate_context(context):
    require(isinstance(context, dict) and set(context) == CONTEXT_FIELDS, "invalid context fields")
    require(isinstance(context["repository"], str) and len(context["repository"].split("/")) == 2
            and all(context["repository"].split("/")), "invalid repository")
    require(type(context["pr_number"]) is int and context["pr_number"] > 0, "invalid PR number")
    for key in ("head_sha", "base_sha", "tested_sha"):
        require(isinstance(context[key], str) and re.fullmatch(r"[0-9a-f]{40}", context[key]), "invalid " + key)
    require(isinstance(context["policy_sha256"], str)
            and re.fullmatch(r"[0-9a-f]{64}", context["policy_sha256"]), "invalid policy digest")


def validate_policy(policy):
    require(type(policy.get("version")) is int and policy["version"] == 1, "unsupported policy version")
    for key in ("low_risk_paths", "high_risk_paths"):
        require(isinstance(policy.get(key), list)
                and all(isinstance(x, str) and x for x in policy[key]), "invalid " + key)
    checks = policy.get("required_checks")
    require(isinstance(checks, dict) and set(checks) == set(LEVELS), "invalid check matrix")
    previous = set()
    for level in LEVELS:
        names = checks[level]
        require(isinstance(names, list) and names and all(isinstance(x, str) and x for x in names), "empty/invalid checks")
        require(len(names) == len(set(names)) and previous <= set(names), "checks must be unique and cumulative")
        previous = set(names)


def classify(policy, changes):
    require(isinstance(changes, list) and changes, "complete nonempty change list required")
    paths = []
    for change in changes:
        require(isinstance(change, dict), "invalid change record")
        require(change.get("status") in {"added", "modified", "removed", "renamed", "copied", "changed"}, "unknown change status")
        paths.append(valid_path(change.get("path")))
        if change["status"] in {"renamed", "copied"}:
            paths.append(valid_path(change.get("previous_path")))
        elif "previous_path" in change:
            paths.append(valid_path(change["previous_path"]))
    matches = lambda path, key: any(fnmatch.fnmatchcase(path, pattern) for pattern in policy[key])
    if any(matches(path, "high_risk_paths") for path in paths):
        return "L2"
    if all(matches(path, "low_risk_paths") for path in paths):
        return "L0"
    return "L1"


def validate_review(review):
    require(isinstance(review, dict), "invalid review")
    require(review.get("status") in {"complete", "unavailable", "error"}, "invalid review status")
    require(review.get("minimum_risk") in LEVELS, "invalid review risk")
    require(review.get("coverage") in {"complete", "partial"}, "invalid review coverage")
    require(isinstance(review.get("unresolved_questions"), list)
            and all(isinstance(x, str) and x for x in review["unresolved_questions"]), "invalid review questions")
    findings = review.get("findings")
    require(isinstance(findings, list), "invalid review findings")
    for item in findings:
        require(isinstance(item, dict) and type(item.get("blocking")) is bool, "invalid finding blocking flag")
        valid_path(item.get("file"))
        require(type(item.get("line")) is int and item["line"] > 0, "invalid finding line")
        for key in ("title", "trigger", "impact", "evidence"):
            require(isinstance(item.get(key), str) and item[key].strip(), "missing finding " + key)


def evaluate(policy, context, evidence):
    validate_policy(policy)
    validate_context(context)
    require(isinstance(evidence, dict), "invalid evidence")
    level = classify(policy, evidence.get("changed_files"))
    reasons = []
    if evidence.get("context") != context:
        reasons.append("evidence context is stale or mismatched")
    if evidence.get("changes_complete") is not True:
        reasons.append("change list is incomplete")
    requested = evidence.get("declared_risk", "L0")
    require(requested in LEVELS, "invalid declared risk")
    level = max((level, requested), key=LEVELS.index)
    review = evidence.get("review")
    if review is not None:
        validate_review(review)
        level = max((level, review["minimum_risk"]), key=LEVELS.index)
        if review.get("context") != context:
            reasons.append("review context is stale or mismatched")
        if review["status"] != "complete" or review["coverage"] != "complete":
            reasons.append("independent review is incomplete")
        if review["unresolved_questions"]:
            reasons.append("review has unresolved questions")
        if any(item["blocking"] for item in review["findings"]):
            reasons.append("review has blocking findings")
    elif level != "L0":
        reasons.append("independent review is missing")

    checks = evidence.get("checks")
    require(isinstance(checks, list), "invalid check results")
    by_name = {}
    for check in checks:
        require(isinstance(check, dict) and isinstance(check.get("name"), str), "invalid check")
        require(check["name"] not in by_name, "duplicate check name")
        by_name[check["name"]] = check
    for name in policy["required_checks"][level]:
        check = by_name.get(name)
        if check is None or check.get("status") != "success":
            reasons.append("required check is not successful: " + name)
        elif check.get("context") != context:
            reasons.append("check context is stale or mismatched: " + name)

    if level == "L2":
        approval = evidence.get("human_approval")
        if not (isinstance(approval, dict) and approval.get("state") == "approved"
                and approval.get("context") == context and approval.get("authorized") is True
                and isinstance(approval.get("reviewer"), str) and approval["reviewer"].strip()):
            reasons.append("current authorized human approval is required for L2")

    return {"decision": "eligible" if not reasons else "hold", "risk": level,
            "required_checks": policy["required_checks"][level], "reasons": reasons}


def read_json(path):
    def unique_keys(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "duplicate JSON key: " + key)
            result[key] = value
        return result
    return json.loads(Path(path).read_text(encoding="utf-8"), object_pairs_hook=unique_keys)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("policy", "context", "evidence"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    try:
        policy, context, evidence = (read_json(path) for path in (args.policy, args.context, args.evidence))
        validate_context(context)
        digest = hashlib.sha256(Path(args.policy).read_bytes()).hexdigest()
        require(context["policy_sha256"] == digest, "policy digest does not match active policy")
        result = evaluate(policy, context, evidence)
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as error:
        print(json.dumps({"decision": "invalid", "reasons": [str(error)]}, ensure_ascii=True))
        return 2
    print(json.dumps(result, ensure_ascii=True, indent=2))
    return 0 if result["decision"] == "eligible" else 1


if __name__ == "__main__":
    sys.exit(main())
