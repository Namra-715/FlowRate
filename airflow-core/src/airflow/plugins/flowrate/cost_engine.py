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
import os
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, cast

from airflow.configuration import conf
from airflow.plugins.flowrate.persistence import save_task_metric

if TYPE_CHECKING:
    from kubernetes.client.models import V1Pod

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
    # Load FlowRate pricing config, using hardcoded defaults for now
    return FlowRatePricing(
        cpu_price_per_core_hour=_safe_float("flowrate", "cpu_price_per_core_hour", 0.031611),
        memory_price_per_gib_hour=_safe_float("flowrate", "memory_price_per_gib_hour", 0.004237),
    )


def _cost_basis() -> str:
    # Normalize configured cost basis, defaults to auto if invalid
    raw = conf.get("flowrate", "cost_basis", fallback="auto").lower().strip()
    if raw in ("auto", "requests", "usage"):
        return raw
    return "auto"


def estimate_cost(
    *,
    cpu_request_cores: float | None,
    memory_request_gib: float | None,
    duration_seconds: float,
    pricing: FlowRatePricing | None = None,
) -> float | None:
    # Estimates cost from requested CPU/memory resources over task duration
    if duration_seconds <= 0:
        return 0.0
    if cpu_request_cores is None and memory_request_gib is None:
        return None
    effective_pricing = pricing or get_pricing()
    hours = duration_seconds / 3600.0
    cpu_cost = (cpu_request_cores or 0.0) * effective_pricing.cpu_price_per_core_hour * hours
    memory_cost = (memory_request_gib or 0.0) * effective_pricing.memory_price_per_gib_hour * hours
    return round(cpu_cost + memory_cost, 8)


def estimate_cost_from_usage_metrics(
    *,
    cpu_seconds: float | None,
    max_rss_mb: float | None,
    duration_seconds: float,
    pricing: FlowRatePricing | None = None,
) -> float | None:
    # Estimates cost from observed usage metrics instead of Kubernetes requests
    if duration_seconds <= 0:
        return 0.0
    if cpu_seconds is None and max_rss_mb is None:
        return None
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


def estimate_cost_auto(
    *,
    cpu_seconds: float | None,
    max_rss_mb: float | None,
    cpu_request_cores: float | None,
    memory_request_gib: float | None,
    duration_seconds: float,
    pricing: FlowRatePricing | None = None,
) -> float | None:
    # Mixes usage metrics and request values, preferring usage when available
    if duration_seconds <= 0:
        return 0.0
    effective_pricing = pricing or get_pricing()
    hours = duration_seconds / 3600.0

    if cpu_seconds is not None:
        cpu_cost = (cpu_seconds / 3600.0) * effective_pricing.cpu_price_per_core_hour
    elif cpu_request_cores is not None:
        cpu_cost = cpu_request_cores * hours * effective_pricing.cpu_price_per_core_hour
    else:
        cpu_cost = 0.0

    if max_rss_mb is not None:
        mem_cost = (max_rss_mb / 1024.0) * hours * effective_pricing.memory_price_per_gib_hour
    elif memory_request_gib is not None:
        mem_cost = memory_request_gib * hours * effective_pricing.memory_price_per_gib_hour
    else:
        mem_cost = 0.0

    if cpu_seconds is None and max_rss_mb is None and cpu_request_cores is None and memory_request_gib is None:
        return None
    if cpu_cost == 0.0 and mem_cost == 0.0:
        return None
    return round(cpu_cost + mem_cost, 8)


def _parse_cpu_to_cores(cpu: str) -> float | None:
    # Parses Kubernetes CPU strings "500m" into units
    value = cpu.strip()
    if not value:
        return None
    if value.endswith("m"):
        milli = float(value[:-1])
        return milli / 1000.0
    return float(value)


def _parse_memory_to_gib(memory: str) -> float | None:
    # Parses Kubernetes memory strings into units
    value = memory.strip()
    if not value:
        return None
    units: dict[str, float] = {
        "Ki": 1 / (1024**2),
        "Mi": 1 / 1024,
        "Gi": 1.0,
        "Ti": 1024.0,
        "K": 1 / (1000**3),
        "M": 1 / (1000**2),
        "G": 1 / 1000,
        "T": 1.0,
    }
    for suffix, factor in units.items():
        if value.endswith(suffix):
            return float(value.removesuffix(suffix)) * factor
    return float(value) / (1024**3)


def _get_default_kubernetes_namespace() -> str:
    return conf.get("flowrate", "kubernetes_namespace", fallback=os.environ.get("POD_NAMESPACE", "default"))


def _fetch_kubernetes_requests(
    *,
    pod_name: str,
    namespace: str | None = None,
    container_name: str | None = None,
) -> tuple[float | None, float | None]:
    # Fetches CPU and memory requests from the matching Kubernetes pod/container
    try:
        from kubernetes import client as k8s_client
        from kubernetes import config as k8s_config
    except Exception:
        log.debug("kubernetes package not available, skipping FlowRate K8s lookup.")
        return None, None

    effective_namespace = namespace or _get_default_kubernetes_namespace()
    try:
        try:
            k8s_config.load_incluster_config()
        except Exception:
            k8s_config.load_kube_config()
        api = k8s_client.CoreV1Api()
        pod: V1Pod = cast(V1Pod, api.read_namespaced_pod(name=pod_name, namespace=effective_namespace))
    except Exception:
        log.debug("Failed to fetch pod metadata for %s/%s", effective_namespace, pod_name, exc_info=True)
        return None, None

    total_cpu = 0.0
    total_memory = 0.0
    has_any = False
    if not pod.spec:
        return None, None
    for container in pod.spec.containers:
        if container_name and container.name != container_name:
            continue
        requests = (container.resources.requests or {}) if container.resources else {}
        cpu_str = requests.get("cpu")
        mem_str = requests.get("memory")
        cpu = _parse_cpu_to_cores(cpu_str) if cpu_str else None
        memory = _parse_memory_to_gib(mem_str) if mem_str else None
        if cpu is not None:
            total_cpu += cpu
            has_any = True
        if memory is not None:
            total_memory += memory
            has_any = True
    if not has_any:
        return None, None
    return (total_cpu if total_cpu > 0 else None, total_memory if total_memory > 0 else None)


def persist_estimated_ti_cost(ti: TaskInstance, *, end_date: datetime | None = None) -> None:
    # Computes a task instance cost estimate and persists it with task metrics
    if not ti.start_date:
        return
    effective_end = end_date or ti.end_date
    if not effective_end:
        return
    duration_seconds = max((effective_end - ti.start_date).total_seconds(), 0.0)
    cpu_request, memory_request = _fetch_kubernetes_requests(pod_name=ti.hostname or "")
    pricing = get_pricing()
    basis = _cost_basis()
    cpu_seconds = getattr(ti, "cpu_seconds", None)
    max_rss_mb = getattr(ti, "max_rss_mb", None)

    if basis == "requests":
        estimated_cost = estimate_cost(
            cpu_request_cores=cpu_request,
            memory_request_gib=memory_request,
            duration_seconds=duration_seconds,
            pricing=pricing,
        )
    elif basis == "usage":
        estimated_cost = estimate_cost_from_usage_metrics(
            cpu_seconds=cpu_seconds,
            max_rss_mb=max_rss_mb,
            duration_seconds=duration_seconds,
            pricing=pricing,
        )
    else:
        estimated_cost = estimate_cost_auto(
            cpu_seconds=cpu_seconds,
            max_rss_mb=max_rss_mb,
            cpu_request_cores=cpu_request,
            memory_request_gib=memory_request,
            duration_seconds=duration_seconds,
            pricing=pricing,
        )

    save_task_metric(
        dag_id=ti.dag_id,
        run_id=ti.run_id,
        task_id=ti.task_id,
        start_date=ti.start_date,
        end_date=effective_end,
        cpu_request=cpu_request,
        memory_request=memory_request,
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