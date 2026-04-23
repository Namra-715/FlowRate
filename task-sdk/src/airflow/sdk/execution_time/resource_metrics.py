#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Resource metrics collection and persistence for cost estimation.

Per-task CPU and RAM metrics are collected in-process (local collector).
Metrics are aggregated over the full process tree (root + all children
recursively) so that subprocesses (BashOperator, dbt, spark-submit, etc.)
are included. Results are written under a configurable metrics directory:
per-task JSON files plus an aggregated per-DAG-run JSON file. Design is
extendable to cloud collectors (e.g. AWS, GCP) that produce the same
payload shape.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

SCHEMA_VERSION = 1
EXECUTION_PLATFORM_LOCAL = "local"
DEFAULT_METRICS_DIR_NAME = "metrics"
SAMPLE_INTERVAL_SECONDS = 2.0

def get_metrics_base_path() -> Path:
    """Return the base directory for metrics files (e.g. AIRFLOW_HOME/metrics)."""
    base = os.environ.get("AIRFLOW_HOME", os.getcwd())
    return Path(base) / DEFAULT_METRICS_DIR_NAME


def _get_process_tree(pid: int) -> list[Any]:
    """Return root process plus all descendants (recursive). Skips processes that are gone."""
    import psutil

    try:
        root = psutil.Process(pid)
    except (ProcessLookupError, psutil.NoSuchProcess, psutil.AccessDenied):
        return []
    procs = [root]
    try:
        procs.extend(root.children(recursive=True))
    except (ProcessLookupError, psutil.NoSuchProcess, psutil.AccessDenied):
        pass
    return procs


def _tree_rss_mb(procs: list[Any]) -> float:
    """Sum RSS in bytes for all processes in tree, return MB."""
    import psutil

    total = 0
    for p in procs:
        try:
            if p.is_running():
                total += p.memory_info().rss
        except (ProcessLookupError, psutil.NoSuchProcess, psutil.AccessDenied, AttributeError):
            continue
    return total / (1024 * 1024)


def _tree_cpu_seconds(procs: list[Any]) -> float:
    """Sum user + system CPU time (seconds) for all processes in tree."""
    import psutil

    total = 0.0
    for p in procs:
        try:
            if p.is_running():
                times = p.cpu_times()
                total += times.user + times.system
        except (ProcessLookupError, psutil.NoSuchProcess, psutil.AccessDenied, AttributeError):
            continue
    return total


def _tree_io_counters(procs: list[Any]) -> tuple[int, int]:
    """Sum read_bytes and write_bytes for all processes in tree. Returns (read_bytes, write_bytes)."""
    import psutil

    read_bytes = 0
    write_bytes = 0
    for p in procs:
        try:
            if p.is_running():
                io = p.io_counters()
                if io is not None:
                    read_bytes += io.read_bytes
                    write_bytes += io.write_bytes
        except (ProcessLookupError, psutil.NoSuchProcess, psutil.AccessDenied, AttributeError):
            continue
        except OSError:
            # io_counters() can fail or be unsupported on some platforms
            continue
    return read_bytes, write_bytes


class LocalResourceCollector:
    """
    Collects CPU, RAM, and I/O usage for the process tree (root + all children)
    over an interval. Intended to be started before task execution and stopped
    after, to produce one payload per task instance. Subprocesses (e.g. dbt,
    spark-submit, BashOperator child shells) are included. Extendable by adding
    other collector classes (e.g. cloud API) that return the same payload shape.
    """

    def __init__(self, pid: int | None = None) -> None:
        self._pid = pid or os.getpid()
        self._start_time: float = 0.0
        self._end_time: float = 0.0
        self._stop_requested = threading.Event()
        self._thread: threading.Thread | None = None
        self._samples: list[dict[str, Any]] = []
        self._max_rss_mb: float = 0.0
        self._last_cpu_sum: float = 0.0
        self._cpu_seconds_accumulated: float = 0.0
        self._start_read_bytes: int = 0
        self._start_write_bytes: int = 0

    def start(self) -> None:
        self._start_time = time.monotonic()
        self._max_rss_mb = 0.0
        self._samples = []
        self._cpu_seconds_accumulated = 0.0
        self._start_read_bytes = 0
        self._start_write_bytes = 0
        procs = _get_process_tree(self._pid)
        if procs:
            self._max_rss_mb = _tree_rss_mb(procs)
            self._last_cpu_sum = _tree_cpu_seconds(procs)
            self._start_read_bytes, self._start_write_bytes = _tree_io_counters(procs)
        else:
            self._last_cpu_sum = 0.0
        self._stop_requested.clear()
        self._thread = threading.Thread(target=self._sample_loop, daemon=True)
        self._thread.start()

    def _sample_loop(self) -> None:
        import psutil

        while not self._stop_requested.wait(timeout=SAMPLE_INTERVAL_SECONDS):
            procs = _get_process_tree(self._pid)
            if not procs:
                break
            try:
                if not procs[0].is_running():
                    break
            except (ProcessLookupError, psutil.NoSuchProcess, psutil.AccessDenied):
                break
            total_rss_mb = _tree_rss_mb(procs)
            if total_rss_mb > self._max_rss_mb:
                self._max_rss_mb = total_rss_mb
            total_cpu = _tree_cpu_seconds(procs)
            delta = total_cpu - self._last_cpu_sum
            if delta > 0:
                self._cpu_seconds_accumulated += delta
            self._last_cpu_sum = total_cpu
            elapsed = time.monotonic() - self._start_time
            cpu_pct = (delta / SAMPLE_INTERVAL_SECONDS * 100.0) if SAMPLE_INTERVAL_SECONDS > 0 else 0.0
            self._samples.append(
                {
                    "timestamp": round(elapsed, 2),
                    "cpu_delta_seconds": round(delta, 3),
                    "cpu_percent": round(cpu_pct, 2),
                    "rss_mb": round(total_rss_mb, 2),
                }
            )

    def stop(self) -> dict[str, Any]:
        """Stop sampling and return aggregated metrics for this task."""
        self._stop_requested.set()
        if self._thread is not None:
            self._thread.join(timeout=SAMPLE_INTERVAL_SECONDS * 2)
            self._thread = None
        self._end_time = time.monotonic()
        duration_seconds = self._end_time - self._start_time

        procs = _get_process_tree(self._pid)
        if procs:
            total_rss_mb = _tree_rss_mb(procs)
            if total_rss_mb > self._max_rss_mb:
                self._max_rss_mb = total_rss_mb
            total_cpu = _tree_cpu_seconds(procs)
            delta = total_cpu - self._last_cpu_sum
            if delta > 0:
                self._cpu_seconds_accumulated += delta
        final_read_bytes, final_write_bytes = _tree_io_counters(procs) if procs else (0, 0)
        read_bytes = max(final_read_bytes - self._start_read_bytes, 0)
        write_bytes = max(final_write_bytes - self._start_write_bytes, 0)

        cpu_seconds = round(self._cpu_seconds_accumulated, 3)
        avg_cpu_cores = (
            round(cpu_seconds / duration_seconds, 4) if duration_seconds and duration_seconds > 0 else None
        )

        payload = {
            "schema_version": SCHEMA_VERSION,
            "execution_platform": EXECUTION_PLATFORM_LOCAL,
            "duration_seconds": round(duration_seconds, 3),
            "cpu_seconds": cpu_seconds,
            "max_rss_mb": round(self._max_rss_mb, 2),
            "samples": self._samples[-100:],
        }
        if avg_cpu_cores is not None:
            payload["avg_cpu_cores"] = avg_cpu_cores
        if read_bytes > 0 or write_bytes > 0:
            payload["read_bytes"] = read_bytes
            payload["write_bytes"] = write_bytes
        return payload


def _safe_run_id(run_id: str) -> str:
    """Sanitize run_id for use in file paths."""
    return run_id.replace("/", "_").replace(":", "_")


def write_task_metrics(
    dag_id: str,
    run_id: str,
    task_id: str,
    try_number: int,
    map_index: int | None,
    execution_platform: str,
    payload: dict[str, Any],
) -> None:
    """Write one JSON file per task instance under metrics/<dag_id>/<run_id>/."""
    base = get_metrics_base_path()
    safe_run = _safe_run_id(run_id)
    run_dir = base / dag_id / safe_run
    run_dir.mkdir(parents=True, exist_ok=True)
    suffix = f"__try_{try_number}" if try_number else ""
    if map_index is not None and map_index >= 0:
        suffix += f"__map_{map_index}"
    filename = f"{task_id}{suffix}.json"
    path = run_dir / filename
    task_record = {
        "schema_version": SCHEMA_VERSION,
        "dag_id": dag_id,
        "run_id": run_id,
        "task_id": task_id,
        "try_number": try_number,
        "map_index": map_index,
        "execution_platform": execution_platform,
        **payload,
    }
    try:
        path.write_text(json.dumps(task_record, indent=2), encoding="utf-8")
    except OSError as e:
        log.warning("Failed to write task metrics file %s: %s", path, e)


def aggregate_and_write_dag_run_metrics(dag_id: str, run_id: str) -> None:
    """
    Read all per-task JSON files under metrics/<dag_id>/<run_id>/ and write
    a single aggregated metrics/<dag_id>/<run_id>.json with per-task and
    DAG-level aggregates.
    """
    base = get_metrics_base_path()
    safe_run = _safe_run_id(run_id)
    run_dir = base / dag_id / safe_run
    if not run_dir.is_dir():
        return
    tasks_data: dict[str, dict[str, Any]] = {}
    total_cpu_seconds = 0.0
    max_rss_mb = 0.0
    total_read_bytes = 0
    total_write_bytes = 0
    for path in run_dir.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            task_id = data.get("task_id", path.stem)
            try_number = data.get("try_number", 0)
            map_index = data.get("map_index")
            key = f"{task_id}__try_{try_number}"
            if map_index is not None and map_index >= 0:
                key += f"__map_{map_index}"
            task_entry = {
                "task_id": task_id,
                "try_number": try_number,
                "map_index": map_index,
                "execution_platform": data.get("execution_platform", EXECUTION_PLATFORM_LOCAL),
                "cpu_seconds": data.get("cpu_seconds", 0),
                "max_rss_mb": data.get("max_rss_mb", 0),
                "duration_seconds": data.get("duration_seconds", 0),
            }
            if "avg_cpu_cores" in data:
                task_entry["avg_cpu_cores"] = data["avg_cpu_cores"]
            if "read_bytes" in data:
                task_entry["read_bytes"] = data["read_bytes"]
                total_read_bytes += data["read_bytes"]
            if "write_bytes" in data:
                task_entry["write_bytes"] = data["write_bytes"]
                total_write_bytes += data["write_bytes"]
            tasks_data[key] = task_entry
            total_cpu_seconds += data.get("cpu_seconds", 0)
            max_rss_mb = max(max_rss_mb, data.get("max_rss_mb", 0))
        except (json.JSONDecodeError, OSError) as e:
            log.warning("Failed to read task metrics %s: %s", path, e)
    out_path = base / dag_id / f"{safe_run}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    dag_metrics: dict[str, Any] = {
        "total_cpu_seconds": round(total_cpu_seconds, 3),
        "max_rss_mb": round(max_rss_mb, 2),
        "task_count": len(tasks_data),
    }
    if total_read_bytes > 0 or total_write_bytes > 0:
        dag_metrics["total_read_bytes"] = total_read_bytes
        dag_metrics["total_write_bytes"] = total_write_bytes
    dag_run_doc = {
        "schema_version": SCHEMA_VERSION,
        "dag_id": dag_id,
        "run_id": run_id,
        "execution_platform": EXECUTION_PLATFORM_LOCAL,
        "tasks": tasks_data,
        "dag_metrics": dag_metrics,
    }
    try:
        out_path.write_text(json.dumps(dag_run_doc, indent=2), encoding="utf-8")
    except OSError as e:
        log.warning("Failed to write DAG run metrics file %s: %s", out_path, e)
