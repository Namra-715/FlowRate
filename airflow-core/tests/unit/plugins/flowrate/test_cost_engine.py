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

import pytest

from airflow.plugins.flowrate.cost_engine import (
    FlowRatePricing,
    _parse_cpu_to_cores,
    _parse_memory_to_gib,
    aggregate_costs_by_time_window,
    estimate_cost,
    estimate_cost_auto,
    estimate_cost_from_usage_metrics,
    floor_to_window,
    safe_round,
)

FIXED_PRICING = FlowRatePricing(cpu_price_per_core_hour=1.0, memory_price_per_gib_hour=1.0)


# ---------------------------------------------------------------------------
# estimate_cost (request-based)
# ---------------------------------------------------------------------------


class TestEstimateCost:
    def test_normal_cpu_only(self):
        result = estimate_cost(
            cpu_request_cores=2.0,
            memory_request_gib=None,
            duration_seconds=3600.0,
            pricing=FIXED_PRICING,
        )
        assert result == 2.0

    def test_normal_memory_only(self):
        result = estimate_cost(
            cpu_request_cores=None,
            memory_request_gib=4.0,
            duration_seconds=3600.0,
            pricing=FIXED_PRICING,
        )
        assert result == 4.0

    def test_normal_both(self):
        result = estimate_cost(
            cpu_request_cores=1.0,
            memory_request_gib=1.0,
            duration_seconds=3600.0,
            pricing=FIXED_PRICING,
        )
        assert result == 2.0

    def test_zero_duration_returns_zero(self):
        result = estimate_cost(
            cpu_request_cores=2.0,
            memory_request_gib=4.0,
            duration_seconds=0.0,
            pricing=FIXED_PRICING,
        )
        assert result == 0.0

    def test_negative_duration_returns_zero(self):
        result = estimate_cost(
            cpu_request_cores=2.0,
            memory_request_gib=4.0,
            duration_seconds=-10.0,
            pricing=FIXED_PRICING,
        )
        assert result == 0.0

    def test_both_none_returns_none(self):
        result = estimate_cost(
            cpu_request_cores=None,
            memory_request_gib=None,
            duration_seconds=3600.0,
            pricing=FIXED_PRICING,
        )
        assert result is None

    def test_half_hour_duration(self):
        result = estimate_cost(
            cpu_request_cores=1.0,
            memory_request_gib=None,
            duration_seconds=1800.0,
            pricing=FIXED_PRICING,
        )
        assert result == 0.5


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


# ---------------------------------------------------------------------------
# estimate_cost_auto
# ---------------------------------------------------------------------------


class TestEstimateCostAuto:
    def test_all_none_returns_none(self):
        result = estimate_cost_auto(
            cpu_seconds=None,
            max_rss_mb=None,
            cpu_request_cores=None,
            memory_request_gib=None,
            duration_seconds=3600.0,
            pricing=FIXED_PRICING,
        )
        assert result is None

    def test_zero_duration_returns_zero(self):
        result = estimate_cost_auto(
            cpu_seconds=3600.0,
            max_rss_mb=1024.0,
            cpu_request_cores=1.0,
            memory_request_gib=1.0,
            duration_seconds=0.0,
            pricing=FIXED_PRICING,
        )
        assert result == 0.0


# ---------------------------------------------------------------------------
# _parse_cpu_to_cores
# ---------------------------------------------------------------------------


class TestParseCpuToCores:
    def test_millicores(self):
        assert _parse_cpu_to_cores("500m") == 0.5

    def test_whole_cores(self):
        assert _parse_cpu_to_cores("1") == 1.0

    def test_two_thousand_millicores(self):
        assert _parse_cpu_to_cores("2000m") == 2.0

    def test_empty_string_returns_none(self):
        assert _parse_cpu_to_cores("") is None

    def test_whitespace_only_returns_none(self):
        assert _parse_cpu_to_cores("   ") is None

    def test_fractional_cores(self):
        assert _parse_cpu_to_cores("0.25") == 0.25


# ---------------------------------------------------------------------------
# _parse_memory_to_gib
# ---------------------------------------------------------------------------


class TestParseMemoryToGib:
    def test_mebibytes(self):
        result = _parse_memory_to_gib("512Mi")
        assert result == pytest.approx(0.5)

    def test_gibibytes(self):
        assert _parse_memory_to_gib("1Gi") == 1.0

    def test_kibibytes(self):
        result = _parse_memory_to_gib("1048576Ki")
        assert result == pytest.approx(1.0)

    def test_tebibytes(self):
        result = _parse_memory_to_gib("1Ti")
        assert result == 1024.0

    def test_empty_string_returns_none(self):
        assert _parse_memory_to_gib("") is None

    def test_raw_bytes(self):
        result = _parse_memory_to_gib("1073741824")
        assert result == pytest.approx(1.0)


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
