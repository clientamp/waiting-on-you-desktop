"""Offline priority agreement, with explicitly opted-in model evaluation."""

import argparse
import json
import sys
from pathlib import Path
from .store import Store


def agreement(store, labels, predictions=None):
    matrix = [[0] * 4 for _ in range(4)]  # rows user label, columns prediction
    missing = []
    skipped = 0
    for item in labels:
        label = item.get("dave", item.get("label", item.get("quadrant")))
        if label is None:
            skipped += 1
            continue
        if type(label) is not int or label not in (1, 2, 3, 4):
            raise ValueError("labels must be integer 1-4 or null")
        task_id = item.get("task_id")
        if type(task_id) is not int:
            raise ValueError("task_id must be an integer")
        task = store.get_task(task_id)
        prediction = (
            predictions.get(task_id)
            if predictions is not None
            else ((task or {}).get("model_quadrant") or (task or {}).get("quadrant"))
        )
        if prediction is None:
            missing.append(task_id)
            continue
        matrix[label - 1][prediction - 1] += 1
    total = sum(map(sum, matrix))
    matched = sum(matrix[i][i] for i in range(4))
    return {
        "matched": matched,
        "total": total,
        "agreement": matched / total if total else None,
        "confusion_matrix": matrix,
        "matrix_rows": "user",
        "matrix_columns": "prediction",
        "skipped_null": skipped,
        "missing_task_ids": missing,
    }


def main(argv, data_dir):
    parser = argparse.ArgumentParser(prog="wou eval-priorities")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--labels", type=Path)
    source.add_argument("--from-db", action="store_true")
    parser.add_argument("--live", action="store_true")
    parser.add_argument(
        "--db",
        type=Path,
        default=Path(data_dir) / "wou.db",
        help="Override task database (e.g. a test copy)",
    )
    args = parser.parse_args(argv)
    if not args.db.is_file():
        print("Task database does not exist", file=sys.stderr)
        return 1
    store = Store(str(args.db))
    try:
        labels = (
            store.priority_labels()
            if args.from_db
            else json.loads(args.labels.read_text())["labels"]
        )
        if not isinstance(labels, list) or any(not isinstance(x, dict) for x in labels):
            raise ValueError("labels must be a list of objects")
        report: dict = {"stored": agreement(store, labels)}
        if args.live:
            print(
                "WARNING: --live spends model calls; task database will not be reclassified.",
                file=sys.stderr,
            )
            from .collect import Config, collect_all
            from .config import load_config
            from .classify import build_messages, parse_response, make_default_llm
            from .settings import load_settings

            cfg = Config.from_dict(load_config(data_dir).get("collect") or {})
            chats, notes = collect_all(cfg, Path(data_dir) / "cache", data_dir=data_dir)
            by_key = {chat["key"]: chat for chat in chats}
            call = make_default_llm()
            predictions = {}
            import time

            now = time.time()
            for key in {
                t["chat_key"]
                for row in labels
                if row.get("dave", row.get("label", row.get("quadrant"))) is not None
                and (t := store.get_task(row["task_id"]))
            }:
                chat = by_key.get(key)
                if not chat:
                    continue
                evaluated_ids = {x["task_id"] for x in labels}
                tasks = [dict(t, quadrant=t.get("model_quadrant")) if t["id"] in evaluated_ids else t for t in store.open_tasks_for_chat(key)]
                result = parse_response(
                    call(
                        build_messages(
                            chat,
                            tasks,
                            [],
                            now,
                            load_settings(data_dir).get("priorities_note", ""),
                            [r for r in store.priority_labels() if r["task_id"] not in {x["task_id"] for x in labels}][:8],
                        )
                    ),
                    now=now,
                )
                if result.get("error"):
                    raise ValueError(result["error"])
                from .store import similar

                for task in tasks:
                    matches = sorted(
                        result["asks"],
                        key=lambda ask: similar(ask["ask"], task["ask"]),
                        reverse=True,
                    )
                    if matches and similar(matches[0]["ask"], task["ask"]) >= 0.35:
                        predictions[task["id"]] = matches[0]["quadrant"]
            report["live"] = agreement(store, labels, predictions)
            report["notes"] = notes
        print(json.dumps(report))
        return 0
    except (OSError, ValueError, KeyError, TypeError, RuntimeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        store.close()
