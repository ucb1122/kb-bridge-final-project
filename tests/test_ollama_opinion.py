"""Ollama receives the selected report facts and labels fallback honestly."""
import io
import json
import unittest
from unittest.mock import patch
from urllib.error import URLError

from kb_bridge.integrations.ollama_opinion import generate_opinion
from kb_bridge.repositories import rising_snapshot


@unittest.skipUnless(rising_snapshot.available(), "Local rising snapshot is absent")
class OllamaOpinionTests(unittest.TestCase):
    def test_prompt_contains_selected_report_values(self):
        report = rising_snapshot.report(kind="dong", code="11710690", quarter="20262")
        payload = {"response": json.dumps({"opinions": ["상권 변화가 있습니다."] * 4}, ensure_ascii=False)}
        response = io.BytesIO(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        with patch("kb_bridge.integrations.ollama_opinion.urlopen", return_value=response) as request:
            result = generate_opinion(report, focus_metric="stores")
        sent = json.loads(request.call_args.args[0].data)
        self.assertIn("잠실4동", sent["prompt"])
        self.assertIn("441개", sent["prompt"])
        self.assertIn("38", sent["prompt"])
        self.assertIn("우선분석지표", sent["prompt"])
        self.assertEqual(result["mode"], "ai")

    def test_unavailable_ollama_is_labeled_as_data_summary(self):
        report = rising_snapshot.report(kind="dong", code="11710690", quarter="20262")
        with patch("kb_bridge.integrations.ollama_opinion.urlopen", side_effect=URLError("offline")):
            result = generate_opinion(report)
        self.assertEqual(result["mode"], "data")
        self.assertIn("Ollama 의견을 사용할 수 없어", result["note"])
