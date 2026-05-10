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
import os
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import func, select

from airflow.configuration import conf
from airflow.models.flowrate_metric import FlowRateMetric
from airflow.utils.session import NEW_SESSION, provide_session

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

log = logging.getLogger(__name__)
FLOWRATE_CONFIGURATION_VARIABLE_KEY = "flowrate.ui.configuration"


def _is_flowrate_enabled() -> bool:
    config_enabled = False
    try:
        config_enabled = conf.getboolean("flowrate", "enabled")
    except Exception:
        log.debug("FlowRate configuration not found in airflow.cfg.", exc_info=True)

    env_value = os.getenv("AIRFLOW__FLOWRATE__ENABLED")
    if env_value is not None:
        return env_value.strip().lower() in {"1", "true", "t", "yes", "y", "on"}

    if config_enabled:
        return True

    try:
        from airflow.models.variable import Variable

        ui_configuration = Variable.get(
            FLOWRATE_CONFIGURATION_VARIABLE_KEY,
            default_var=None,
            deserialize_json=True,
        )
        if isinstance(ui_configuration, dict):
            enabled = ui_configuration.get("enabled")
            if isinstance(enabled, bool):
                return enabled
            if isinstance(enabled, str):
                return enabled.strip().lower() in {"1", "true", "t", "yes", "y", "on"}
            if isinstance(enabled, int):
                return enabled != 0
    except Exception:
        log.debug("FlowRate UI configuration not found; treating as disabled.", exc_info=True)

    return False


@provide_session
def save_task_metric(
    dag_id: str,
    run_id: str,
    task_id: str,
    start_date: datetime | None,
    end_date: datetime | None,
    cpu_seconds: float | None = None,
    max_rss_mb: float | None = None,
    avg_cpu_cores: float | None = None,
    read_bytes: int | None = None,
    write_bytes: int | None = None,
    estimated_cost: float | None = None,
    *,
    session: Session = NEW_SESSION,
) -> None:
    """
    Persist a single FlowRate task metric record. This function is a
    no-op if FlowRate is disabled in configuration, and will
    catch and log all exceptions instead of raising.
    """
    if not _is_flowrate_enabled():
        return

    try:
        metric = FlowRateMetric(
            dag_id=dag_id,
            run_id=run_id,
            task_id=task_id,
            start_date=start_date,
            end_date=end_date,
            cpu_seconds=cpu_seconds,
            max_rss_mb=max_rss_mb,
            avg_cpu_cores=avg_cpu_cores,
            read_bytes=read_bytes,
            write_bytes=write_bytes,
            estimated_cost=estimated_cost,
        )
        session.add(metric)
        session.flush()
    except Exception:
        log.exception(
            "Failed to persist FlowRate metric for dag_id=%s, run_id=%s, task_id=%s",
            dag_id,
            run_id,
            task_id,
        )


@provide_session
def get_task_costs(
    dag_id: str,
    run_id: str,
    *,
    session: Session = NEW_SESSION,
) -> list[FlowRateMetric]:
    """Return all FlowRateMetric rows for a specific DAG run (per-task breakdown)."""
    if not _is_flowrate_enabled():
        return []
    return list(
        session.scalars(
            select(FlowRateMetric)
            .where(FlowRateMetric.dag_id == dag_id, FlowRateMetric.run_id == run_id)
            .order_by(FlowRateMetric.start_date)
        ).all()
    )


@provide_session
def get_dag_run_cost(
    dag_id: str,
    run_id: str,
    *,
    session: Session = NEW_SESSION,
) -> float | None:
    """Return the total estimated cost for a single DAG run."""
    if not _is_flowrate_enabled():
        return None
    result = session.scalar(
        select(func.sum(FlowRateMetric.estimated_cost)).where(
            FlowRateMetric.dag_id == dag_id,
            FlowRateMetric.run_id == run_id,
            FlowRateMetric.estimated_cost.isnot(None),
        )
    )
    return round(float(result), 8) if result is not None else None


@provide_session
def get_dag_costs_by_window(
    dag_id: str,
    start_time: datetime,
    end_time: datetime,
    *,
    session: Session = NEW_SESSION,
) -> dict[str, Any] | None:
    """Return total cost and task count for a DAG within a time window."""
    if not _is_flowrate_enabled():
        return None
    row = session.execute(
        select(
            func.coalesce(func.sum(FlowRateMetric.estimated_cost), 0.0),
            func.count(FlowRateMetric.id),
        ).where(
            FlowRateMetric.dag_id == dag_id,
            FlowRateMetric.estimated_cost.isnot(None),
            FlowRateMetric.start_date >= start_time,
            FlowRateMetric.start_date <= end_time,
        )
    ).one()
    if row[1] == 0:
        return None
    return {
        "dag_id": dag_id,
        "total_cost": round(float(row[0]), 8),
        "task_count": int(row[1]),
        "window_start": start_time,
        "window_end": end_time,
    }


@provide_session
def get_top_expensive_dags(
    start_time: datetime,
    end_time: datetime,
    limit: int = 10,
    *,
    session: Session = NEW_SESSION,
) -> list[dict[str, Any]]:
    """Return the top-N most expensive DAGs within a time window."""
    if not _is_flowrate_enabled():
        return []
    rows = session.execute(
        select(
            FlowRateMetric.dag_id,
            func.sum(FlowRateMetric.estimated_cost).label("total_cost"),
            func.count(FlowRateMetric.id).label("task_count"),
        )
        .where(
            FlowRateMetric.estimated_cost.isnot(None),
            FlowRateMetric.start_date >= start_time,
            FlowRateMetric.start_date <= end_time,
        )
        .group_by(FlowRateMetric.dag_id)
        .order_by(func.sum(FlowRateMetric.estimated_cost).desc())
        .limit(limit)
    ).all()
    return [
        {
            "dag_id": row[0],
            "total_cost": round(float(row[1]), 8),
            "task_count": int(row[2]),
        }
        for row in rows
    ]


@provide_session
def get_top_expensive_tasks(
    start_time: datetime,
    end_time: datetime,
    limit: int = 10,
    *,
    session: Session = NEW_SESSION,
) -> list[dict[str, Any]]:
    """Return the top-N most expensive tasks (by dag_id + task_id) within a time window."""
    if not _is_flowrate_enabled():
        return []
    rows = session.execute(
        select(
            FlowRateMetric.dag_id,
            FlowRateMetric.task_id,
            func.sum(FlowRateMetric.estimated_cost).label("total_cost"),
            func.count(FlowRateMetric.id).label("run_count"),
        )
        .where(
            FlowRateMetric.estimated_cost.isnot(None),
            FlowRateMetric.start_date >= start_time,
            FlowRateMetric.start_date <= end_time,
        )
        .group_by(FlowRateMetric.dag_id, FlowRateMetric.task_id)
        .order_by(func.sum(FlowRateMetric.estimated_cost).desc())
        .limit(limit)
    ).all()
    return [
        {
            "dag_id": row[0],
            "task_id": row[1],
            "total_cost": round(float(row[2]), 8),
            "run_count": int(row[3]),
        }
        for row in rows
    ]
