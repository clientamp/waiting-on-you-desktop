"""System One wire adapter (including Cloudflare's result envelope)."""
from __future__ import annotations

import time
from typing import Any
from .base import (Choice, DecisionError, DecisionResult, JsonProvider, Noul,
                   Question, parse_answer, usage_from, validate_questions)


class SystemOneProvider(JsonProvider):
    def decide(self, state: str | dict | list, questions: list[Question]) -> DecisionResult:
        validate_questions(questions)
        if not isinstance(state, (str, dict, list)):
            raise DecisionError("invalid_request")
        wire = {}
        for q in questions:
            item: dict[str, Any] = {"type": "noul" if isinstance(q, Noul) else "choice" if isinstance(q, Choice) else "score",
                    "instructions": q.instructions}
            if isinstance(q, Choice):
                item["criteria"] = q.criteria
            elif not isinstance(q, Noul):
                item["criteria"] = list(q.levels.values())
            wire[q.name] = item
        start = time.monotonic()
        data = self._post({"model": self.model, "state": state, "questions": wire})
        if "result" in data:
            if data.get("success") is False:
                raise DecisionError("bad_response")
            data = data["result"]
        if not isinstance(data, dict) or not isinstance(data.get("answers"), dict):
            raise DecisionError("bad_response")
        answers = {}
        for q in questions:
            answer = parse_answer(q, data["answers"].get(q.name))
            if answer is not None:
                answers[q.name] = answer
        return DecisionResult(answers, self.model, usage_from(data), (time.monotonic() - start) * 1000)
