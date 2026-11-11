"""OpenAI Decisions wire adapter; not a chat/completions client."""
from __future__ import annotations

import json
import time
from typing import Any
from .base import (Choice, DecisionError, DecisionResult, JsonProvider, Noul,
                   Question, Score, parse_answer, usage_from, validate_questions)


class OpenAIDecisionsProvider(JsonProvider):
    def decide(self, state: str | dict | list, questions: list[Question]) -> DecisionResult:
        validate_questions(questions)
        if not isinstance(state, (str, dict, list)):
            raise DecisionError("invalid_request")
        wire = []
        for q in questions:
            item: dict[str, Any] = {"type": "predicate" if isinstance(q, Noul) else "choice" if isinstance(q, Choice) else "score",
                    "name": q.name, "instructions": q.instructions}
            if isinstance(q, Choice):
                item["choices"] = [{"value": k, "description": v} for k, v in q.criteria.items()]
            elif isinstance(q, Score):
                if not 2 <= len(q.levels) <= 10:
                    raise DecisionError("invalid_request")
                item["levels"] = [{"label": k, "description": v} for k, v in q.levels.items()]
            wire.append(item)
        try:
            text = state if isinstance(state, str) else json.dumps(state, allow_nan=False)
        except (TypeError, ValueError):
            raise DecisionError("invalid_request") from None
        start = time.monotonic()
        data = self._post({"model": self.model, "input": text, "questions": wire})
        if not isinstance(data.get("answers"), list):
            raise DecisionError("bad_response")
        by_name = {}
        duplicates = set()
        for raw in data["answers"]:
            if not isinstance(raw, dict) or not isinstance(raw.get("name"), str):
                continue
            name = raw["name"]
            if name in by_name:
                duplicates.add(name)
            by_name[name] = raw
        answers = {}
        for q in questions:
            if q.name in duplicates:
                continue
            answer = parse_answer(q, by_name.get(q.name), openai=True)
            if answer is not None:
                answers[q.name] = answer
        return DecisionResult(answers, self.model, usage_from(data), (time.monotonic() - start) * 1000)
