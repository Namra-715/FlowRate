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

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import mock

from airflow.plugins.flowrate.cost_engine import (
    FlowRatePricing,
    aggregate_costs_by_time_window,
    estimate_cost_from_usage_metrics,
    floor_to_window,
    persist_estimated_ti_cost,
    safe_round,
)

FIXED_PRICING = FlowRatePricing(cpu_price_per_core_hour=1.0, memory_price_per_gib_hour=1.0)


# ---------------------------------------------------------------------------
# estimate_cost_from_usage_metrics
# ---------------------------------------------------------------------------


class TestEstimateCostFromUsageMetrics:
    def test_cpu_only(self):
        result = estimate_cost_from_usage_metrics(
            cpu_seconds=3600.0,
            max_rss_mb=None,
            duration_seconds=3600.0,
            pricing=FIXED_PRICING,
        )
        assert result == 1.0

    def test_memory_only(self):
        result = estimate_cost_from_usage_metrics(
            cpu_seconds=None,
            max_rss_mb=1024.0,
            duration_seconds=3600.0,
            pricing=FIXED_PRICING,
        )
        assert result == 1.0

    def test_both_metrics(self):
        result = estimate_cost_from_usage_metrics(
            cpu_seconds=3600.0,
            max_rss_mb=1024.0,
            duration_seconds=3600.0,
            pricing=FIXED_PRICING,
        )
        assert result == 2.0

    def test_zero_duration_returns_zero(self):
        result = estimate_cost_from_usage_metrics(
            cpu_seconds=3600.0,
            max_rss_mb=1024.0,
            duration_seconds=0.0,
            pricing=FIXED_PRICING,
        )
        assert result == 0.0

    def test_all_none_returns_none(self):
        result = estimate_cost_from_usage_metrics(
            cpu_seconds=None,
            max_rss_mb=None,
            duration_seconds=3600.0,
            pricing=FIXED_PRICING,
        )
        assert result is None


def test_persist_estimated_ti_cost_persists_measured_metrics():
    ti = SimpleNamespace(
        dag_id="flowrate_demo_dag",
        run_id="run_1",
        task_id="flowrate_demo_task",
        start_date=datetime(2026, 4, 21, 0, 0, tzinfo=timezone.utc),
        end_date=datetime(2026, 4, 21, 1, 0, tzinfo=timezone.utc),
        cpu_seconds=1800.0,
        max_rss_mb=512.0,
        avg_cpu_cores=0.5,
        read_bytes=1024,
        write_bytes=2048,
    )

    with (
        mock.patch("airflow.plugins.flowrate.cost_engine.get_pricing", return_value=FIXED_PRICING),
        mock.patch("airflow.plugins.flowrate.cost_engine.save_task_metric") as mock_save_task_metric,
    ):
        persist_estimated_ti_cost(ti)

    mock_save_task_metric.assert_called_once_with(
        dag_id="flowrate_demo_dag",
        run_id="run_1",
        task_id="flowrate_demo_task",
        start_date=ti.start_date,
        end_date=ti.end_date,
        cpu_seconds=1800.0,
        max_rss_mb=512.0,
        avg_cpu_cores=0.5,
        read_bytes=1024,
        write_bytes=2048,
        estimated_cost=1.0,
    )

# ---------------------------------------------------------------------------
# floor_to_window
# ---------------------------------------------------------------------------


class TestFloorToWindow:
    def test_60min_window(self):
        ts = datetime(2026, 4, 14, 10, 35, 0, tzinfo=timezone.utc)
        result = floor_to_window(ts, 60)
        assert result == datetime(2026, 4, 14, 10, 0, 0, tzinfo=timezone.utc)

    def test_15min_window(self):
        ts = datetime(2026, 4, 14, 10, 22, 0, tzinfo=timezone.utc)
        result = floor_to_window(ts, 15)
        assert result == datetime(2026, 4, 14, 10, 15, 0, tzinfo=timezone.utc)

    def test_exact_boundary(self):
        ts = datetime(2026, 4, 14, 10, 0, 0, tzinfo=timezone.utc)
        result = floor_to_window(ts, 60)
        assert result == ts

    def test_1min_window(self):
        ts = datetime(2026, 4, 14, 10, 5, 30, tzinfo=timezone.utc)
        result = floor_to_window(ts, 1)
        assert result == datetime(2026, 4, 14, 10, 5, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# aggregate_costs_by_time_window
# ---------------------------------------------------------------------------


class TestAggregateCostsByTimeWindow:
    def test_normal_bucketing(self):
        rows = [
            {
                "start_date": datetime(2026, 4, 14, 10, 10, tzinfo=timezone.utc),
                "end_date": datetime(2026, 4, 14, 10, 20, tzinfo=timezone.utc),
                "estimated_cost": 1.0,
            },
            {
                "start_date": datetime(2026, 4, 14, 10, 40, tzinfo=timezone.utc),
                "end_date": datetime(2026, 4, 14, 10, 50, tzinfo=timezone.utc),
                "estimated_cost": 2.0,
            },
            {
                "start_date": datetime(2026, 4, 14, 11, 10, tzinfo=timezone.utc),
                "end_date": datetime(2026, 4, 14, 11, 20, tzinfo=timezone.utc),
                "estimated_cost": 3.0,
            },
        ]
        result = aggregate_costs_by_time_window(rows, 60)
        assert len(result) == 2
        assert result[0]["task_count"] == 2
        assert result[0]["estimated_cost"] == 3.0
        assert result[1]["task_count"] == 1
        assert result[1]["estimated_cost"] == 3.0

    def test_empty_rows(self):
        result = aggregate_costs_by_time_window([], 60)
        assert result == []

    def test_rows_with_missing_fields_are_skipped(self):
        rows = [
            {"start_date": datetime(2026, 4, 14, 10, 0, tzinfo=timezone.utc), "estimated_cost": 1.0},
            {"start_date": None, "end_date": None, "estimated_cost": 1.0},
            {
                "start_date": datetime(2026, 4, 14, 10, 0, tzinfo=timezone.utc),
                "end_date": datetime(2026, 4, 14, 10, 5, tzinfo=timezone.utc),
                "estimated_cost": None,
            },
        ]
        result = aggregate_costs_by_time_window(rows, 60)
        assert result == []

    def test_sorted_by_window_start(self):
        rows = [
            {
                "start_date": datetime(2026, 4, 14, 12, 0, tzinfo=timezone.utc),
                "end_date": datetime(2026, 4, 14, 12, 5, tzinfo=timezone.utc),
                "estimated_cost": 1.0,
            },
            {
                "start_date": datetime(2026, 4, 14, 10, 0, tzinfo=timezone.utc),
                "end_date": datetime(2026, 4, 14, 10, 5, tzinfo=timezone.utc),
                "estimated_cost": 2.0,
            },
        ]
        result = aggregate_costs_by_time_window(rows, 60)
        assert result[0]["window_start"] < result[1]["window_start"]


# ---------------------------------------------------------------------------
# safe_round
# ---------------------------------------------------------------------------


class TestSafeRound:
    def test_normal_value(self):
        assert safe_round(1.123456789, 4) == 1.1235

    def test_none_returns_none(self):
        assert safe_round(None) is None

    def test_nan_returns_none(self):
        assert safe_round(float("nan")) is None

    def test_inf_returns_none(self):
        assert safe_round(float("inf")) is None
