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

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING

from airflow.configuration import conf
from airflow.plugins.flowrate.persistence import save_task_metric

if TYPE_CHECKING:
    from airflow.models.taskinstance import TaskInstance

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class FlowRatePricing:
    cpu_price_per_core_hour: float
    memory_price_per_gib_hour: float


def _safe_float(section: str, key: str, fallback: float) -> float:
    # Reads float config value, fall back safely if parsing fails
    try:
        value = conf.getfloat(section, key, fallback=fallback)
        return max(value, 0.0)
    except Exception:
        log.debug("Invalid float configuration for [%s]%s. Using fallback=%s", section, key, fallback)
        return fallback


def get_pricing() -> FlowRatePricing:
    # Load FlowRate pricing config from airflow.cfg.
    return FlowRatePricing(
        cpu_price_per_core_hour=_safe_float("flowrate", "cpu_price_per_core_hour", 0.031611),
        memory_price_per_gib_hour=_safe_float("flowrate", "memory_price_per_gib_hour", 0.004237),
    )


def estimate_cost_from_usage_metrics(
    *,
    cpu_seconds: float | None,
    max_rss_mb: float | None,
    duration_seconds: float,
    pricing: FlowRatePricing | None = None,
) -> float:
    # Estimates cost from observed local task usage metrics.
    if duration_seconds <= 0:
        return 0.0
    if cpu_seconds is None and max_rss_mb is None:
        return 0.0
    effective_pricing = pricing or get_pricing()
    hours = duration_seconds / 3600.0
    cpu_cost = 0.0
    mem_cost = 0.0
    if cpu_seconds is not None:
        cpu_core_hours = cpu_seconds / 3600.0
        cpu_cost = cpu_core_hours * effective_pricing.cpu_price_per_core_hour
    if max_rss_mb is not None:
        peak_gib = max_rss_mb / 1024.0
        mem_cost = peak_gib * hours * effective_pricing.memory_price_per_gib_hour
    return round(cpu_cost + mem_cost, 8)


def persist_estimated_ti_cost(ti: TaskInstance, *, end_date: datetime | None = None) -> None:
    # Computes a task instance cost estimate and persists it with task metrics
    if not ti.start_date:
        return
    effective_end = end_date or ti.end_date
    if not effective_end:
        return
    duration_seconds = max((effective_end - ti.start_date).total_seconds(), 0.0)
    pricing = get_pricing()
    cpu_seconds = getattr(ti, "cpu_seconds", None)
    max_rss_mb = getattr(ti, "max_rss_mb", None)
    estimated_cost = estimate_cost_from_usage_metrics(
        cpu_seconds=cpu_seconds,
        max_rss_mb=max_rss_mb,
        duration_seconds=duration_seconds,
        pricing=pricing,
    )

    save_task_metric(
        dag_id=ti.dag_id,
        run_id=ti.run_id,
        task_id=ti.task_id,
        start_date=ti.start_date,
        end_date=effective_end,
        cpu_seconds=cpu_seconds,
        max_rss_mb=max_rss_mb,
        avg_cpu_cores=getattr(ti, "avg_cpu_cores", None),
        read_bytes=getattr(ti, "read_bytes", None),
        write_bytes=getattr(ti, "write_bytes", None),
        estimated_cost=estimated_cost,
    )


def floor_to_window(ts: datetime, window_minutes: int) -> datetime:
    # Floor timestamp to start of agg window
    window_seconds = max(window_minutes, 1) * 60
    epoch = int(ts.timestamp())
    bucket_start = epoch - (epoch % window_seconds)
    return datetime.fromtimestamp(bucket_start, tz=ts.tzinfo)


def aggregate_costs_by_time_window(rows: list[dict], window_minutes: int) -> list[dict]:
    # Bucket task cost rows into time windows and sums cost/task counts
    buckets: dict[datetime, dict] = {}
    for row in rows:
        start_date = row.get("start_date")
        end_date = row.get("end_date")
        estimated_cost = row.get("estimated_cost")
        if not start_date or not end_date or estimated_cost is None:
            continue
        window_start = floor_to_window(start_date, window_minutes)
        bucket = buckets.setdefault(
            window_start,
            {"window_start": window_start, "estimated_cost": 0.0, "task_count": 0},
        )
        bucket["estimated_cost"] = round(bucket["estimated_cost"] + estimated_cost, 8)
        bucket["task_count"] += 1
    return [buckets[k] for k in sorted(buckets.keys())]


def safe_round(value: float | None, places: int = 8) -> float | None:
    # Safely round numeric values
    if value is None:
        return None
    if math.isnan(value) or math.isinf(value):
        return None
    return round(value, places)
