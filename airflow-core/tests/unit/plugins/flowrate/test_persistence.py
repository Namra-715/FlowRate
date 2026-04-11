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
from unittest import mock

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session as SASession

from airflow.configuration import conf
from airflow.models.base import metadata
from airflow.models.flowrate_metric import FlowRateMetric
from airflow.plugins.flowrate.cost_engine import FlowRatePricing, estimate_cost_auto, estimate_cost_from_usage_metrics
from airflow.plugins.flowrate.persistence import save_task_metric


@pytest.fixture(autouse=True)
def enable_flowrate(monkeypatch):
    """Ensure FlowRate is enabled by default for these tests."""
    with mock.patch.object(conf, "getboolean", return_value=True):
        yield


@pytest.fixture
def in_memory_session():
    """
    Provide a SQLAlchemy session bound to an in-memory SQLite database.

    This bypasses Airflow's session factory so tests remain hermetic.
    """
    engine = create_engine("sqlite:///:memory:")
    metadata.create_all(engine)
    with SASession(bind=engine) as session:
        yield session


def _count_metrics(session: SASession) -> int:
    return session.scalar(select(func.count()).select_from(FlowRateMetric)) or 0


def test_successful_insert(in_memory_session: SASession):
    """save_task_metric inserts a FlowRateMetric row when FlowRate is enabled."""
    assert _count_metrics(in_memory_session) == 0

    now = datetime.now(timezone.utc)
    save_task_metric(
        dag_id="example_dag",
        run_id="run_1",
        task_id="task_1",
        start_date=now,
        end_date=now,
        cpu_request=1.0,
        memory_request=512.0,
        estimated_cost=0.42,
        session=in_memory_session,
    )

    in_memory_session.flush()
    assert _count_metrics(in_memory_session) == 1


def test_duplicate_handling(in_memory_session: SASession):
    """
    Multiple calls for the same dag/run/task are allowed and do not raise.

    The current schema does not enforce uniqueness on (dag_id, run_id, task_id),
    so the expected behaviour is that duplicates create multiple rows.
    """
    now = datetime.now(timezone.utc)

    save_task_metric(
        dag_id="example_dag",
        run_id="run_1",
        task_id="task_1",
        start_date=now,
        end_date=now,
        cpu_request=1.0,
        memory_request=512.0,
        estimated_cost=0.42,
        session=in_memory_session,
    )
    save_task_metric(
        dag_id="example_dag",
        run_id="run_1",
        task_id="task_1",
        start_date=now,
        end_date=now,
        cpu_request=2.0,
        memory_request=1024.0,
        estimated_cost=0.84,
        session=in_memory_session,
    )

    in_memory_session.flush()
    assert _count_metrics(in_memory_session) == 2


def test_graceful_failure_when_db_unavailable(in_memory_session: SASession, caplog):
    """
    save_task_metric should swallow database errors and only log them.
    """
    caplog.set_level("ERROR")

    # Arrange: make session.add raise an exception to simulate DB unavailability.
    with mock.patch.object(in_memory_session, "add", side_effect=Exception("DB unavailable")):
        save_task_metric(
            dag_id="example_dag",
            run_id="run_1",
            task_id="task_1",
            start_date=None,
            end_date=None,
            cpu_request=None,
            memory_request=None,
            estimated_cost=None,
            session=in_memory_session,
        )

    # No rows should be created and no exception should propagate.
    assert _count_metrics(in_memory_session) == 0
    assert any("Failed to persist FlowRate metric" in message for message in caplog.messages)


def test_estimate_cost_from_usage_metrics_matches_core_hours():
    pricing = FlowRatePricing(cpu_price_per_core_hour=2.0, memory_price_per_gib_hour=0.0)
    assert (
        estimate_cost_from_usage_metrics(
            cpu_seconds=7200.0,
            max_rss_mb=None,
            duration_seconds=3600.0,
            pricing=pricing,
        )
        == 4.0
    )


def test_estimate_cost_auto_prefers_measured_cpu_over_k8s_request():
    pricing = FlowRatePricing(cpu_price_per_core_hour=10.0, memory_price_per_gib_hour=1.0)
    assert (
        estimate_cost_auto(
            cpu_seconds=3600.0,
            max_rss_mb=None,
            cpu_request_cores=4.0,
            memory_request_gib=None,
            duration_seconds=3600.0,
            pricing=pricing,
        )
        == 10.0
    )


def test_estimate_cost_auto_falls_back_to_k8s_when_no_measured_metrics():
    pricing = FlowRatePricing(cpu_price_per_core_hour=1.0, memory_price_per_gib_hour=2.0)
    assert (
        estimate_cost_auto(
            cpu_seconds=None,
            max_rss_mb=None,
            cpu_request_cores=1.0,
            memory_request_gib=1.0,
            duration_seconds=3600.0,
            pricing=pricing,
        )
        == 3.0
    )