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

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, cast

from fastapi import Depends, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.sql.expression import case, false

from airflow._shared.timezones import timezone  # type: ignore
from airflow.configuration import conf
from airflow.api_fastapi.auth.managers.models.resource_details import DagAccessEntity
from airflow.api_fastapi.common.db.common import SessionDep
from airflow.api_fastapi.common.parameters import DateTimeQuery, OptionalDateTimeQuery
from airflow.api_fastapi.common.router import AirflowRouter
from airflow.api_fastapi.core_api.datamodels.ui.dashboard import (
    DashboardDagStatsResponse,
    FlowRateConfiguration,
    FlowRateSummaryResourceSplit,
    FlowRateSummaryResponse,
    FlowRateTrendsDagCostRow,
    FlowRateTrendsPricing,
    FlowRateTrendsResourceSplit,
    FlowRateTrendsResponse,
    FlowRateTrendsTaskCostRow,
    HistoricalMetricDataResponse,
)
from airflow.api_fastapi.core_api.openapi.exceptions import create_openapi_http_exception_doc
from airflow.api_fastapi.core_api.security import ReadableDagsFilterDep, requires_access_dag
from airflow.models.dag import DagModel
from airflow.models.dagrun import DagRun, DagRunType
from airflow.models.flowrate_metric import FlowRateMetric
from airflow.models.taskinstance import TaskInstance
from airflow.models.variable import Variable
from airflow.plugins.flowrate.cost_engine import get_pricing
from airflow.utils.state import DagRunState, TaskInstanceState

TOP_DAGS_LIMIT = 7
TOP_TASKS_LIMIT = 10
FLOWRATE_RETENTION_DAYS_DEFAULT = 7
FLOWRATE_RETENTION_DAYS_MIN = 1
FLOWRATE_RETENTION_DAYS_MAX = 365
FLOWRATE_CONFIGURATION_VARIABLE_KEY = "flowrate.ui.configuration"


def _duration_seconds(start_date: datetime | None, end_date: datetime | None) -> float:
    if not start_date or not end_date:
        return 0.0

    return max((end_date - start_date).total_seconds(), 0.0)


def _average(values: list[float]) -> float:
    if not values:
        return 0.0

    return sum(values) / len(values)


def _default_flowrate_configuration() -> FlowRateConfiguration:
    enabled = False
    try:
        enabled = conf.getboolean("flowrate", "enabled")
    except Exception:
        enabled = False
    pricing = get_pricing()

    return FlowRateConfiguration(
        enabled=enabled,
        retention_days=FLOWRATE_RETENTION_DAYS_DEFAULT,
        cpu_price_per_core_hour=pricing.cpu_price_per_core_hour,
        memory_price_per_gib_hour=pricing.memory_price_per_gib_hour,
    )


def _parse_bool(value: Any, fallback: bool) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "t", "yes", "y", "on"}:
            return True
        if lowered in {"0", "false", "f", "no", "n", "off"}:
            return False

    if isinstance(value, int):
        return value != 0

    return fallback


def _sanitize_retention_days(value: Any, fallback: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback

    return min(max(parsed, FLOWRATE_RETENTION_DAYS_MIN), FLOWRATE_RETENTION_DAYS_MAX)


def _sanitize_non_negative_float(value: Any, fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback

    return max(parsed, 0.0)


def _sanitize_flowrate_configuration(raw_value: Any) -> FlowRateConfiguration:
    defaults = _default_flowrate_configuration()

    if not isinstance(raw_value, dict):
        return defaults

    return FlowRateConfiguration(
        enabled=_parse_bool(raw_value.get("enabled"), defaults.enabled),
        retention_days=_sanitize_retention_days(raw_value.get("retention_days"), defaults.retention_days),
        cpu_price_per_core_hour=_sanitize_non_negative_float(
            raw_value.get("cpu_price_per_core_hour"), defaults.cpu_price_per_core_hour
        ),
        memory_price_per_gib_hour=_sanitize_non_negative_float(
            raw_value.get("memory_price_per_gib_hour"), defaults.memory_price_per_gib_hour
        ),
    )


def _load_flowrate_configuration() -> FlowRateConfiguration:
    try:
        value = Variable.get(
            FLOWRATE_CONFIGURATION_VARIABLE_KEY,
            default_var=None,
            deserialize_json=True,
        )
    except Exception:
        value = None

    return _sanitize_flowrate_configuration(value)


dashboard_router = AirflowRouter(tags=["Dashboard"], prefix="/dashboard")


@dashboard_router.get(
    "/flowrate_configuration",
    dependencies=[Depends(requires_access_dag(method="GET"))],
)
def flowrate_configuration() -> FlowRateConfiguration:
    """Return saved FlowRate UI configuration values."""
    return _load_flowrate_configuration()


@dashboard_router.put(
    "/flowrate_configuration",
    dependencies=[Depends(requires_access_dag(method="PUT"))],
)
def update_flowrate_configuration(
    configuration: FlowRateConfiguration,
    session: SessionDep,
) -> FlowRateConfiguration:
    """Persist FlowRate UI configuration values."""
    sanitized_configuration = _sanitize_flowrate_configuration(configuration.model_dump())
    Variable.set(
        key=FLOWRATE_CONFIGURATION_VARIABLE_KEY,
        value=sanitized_configuration.model_dump(),
        serialize_json=True,
        session=session,
    )
    session.flush()

    return sanitized_configuration


@dashboard_router.get(
    "/historical_metrics_data",
    responses=create_openapi_http_exception_doc([status.HTTP_400_BAD_REQUEST]),
    dependencies=[
        Depends(requires_access_dag(method="GET", access_entity=DagAccessEntity.TASK_INSTANCE)),
        Depends(requires_access_dag(method="GET", access_entity=DagAccessEntity.RUN)),
    ],
)
def historical_metrics(
    session: SessionDep,
    start_date: DateTimeQuery,
    readable_dags_filter: ReadableDagsFilterDep,
    end_date: OptionalDateTimeQuery = None,
) -> HistoricalMetricDataResponse:
    """Return cluster activity historical metrics."""
    current_time = timezone.utcnow()
    permitted_dag_ids = cast("set[str]", readable_dags_filter.value)
    # DagRuns
    dag_run_types = session.execute(
        select(DagRun.run_type, func.count(DagRun.run_id))
        .where(
            func.coalesce(DagRun.start_date, current_time) >= start_date,
            func.coalesce(DagRun.end_date, current_time) <= func.coalesce(end_date, current_time),
        )
        .where(DagRun.dag_id.in_(permitted_dag_ids))
        .group_by(DagRun.run_type)
    ).all()

    dag_run_states = session.execute(
        select(DagRun.state, func.count(DagRun.run_id))
        .where(
            func.coalesce(DagRun.start_date, current_time) >= start_date,
            func.coalesce(DagRun.end_date, current_time) <= func.coalesce(end_date, current_time),
        )
        .where(DagRun.dag_id.in_(permitted_dag_ids))
        .group_by(DagRun.state)
    ).all()

    # TaskInstances
    task_instance_states = session.execute(
        select(TaskInstance.state, func.count(TaskInstance.run_id))
        .join(TaskInstance.dag_run)
        .where(
            func.coalesce(DagRun.start_date, current_time) >= start_date,
            func.coalesce(DagRun.end_date, current_time) <= func.coalesce(end_date, current_time),
        )
        .where(DagRun.dag_id.in_(permitted_dag_ids))
        .group_by(TaskInstance.state)
    ).all()

    # Combining historical metrics response as dictionary
    historical_metrics_response = {
        "dag_run_types": {
            **{dag_run_type.value: 0 for dag_run_type in DagRunType},
            **{row.run_type: row.count for row in dag_run_types},
        },
        "dag_run_states": {
            **{dag_run_state.value: 0 for dag_run_state in DagRunState},
            **{row.state: row.count for row in dag_run_states},
        },
        "task_instance_states": {
            "no_status": 0,
            **{ti_state.value: 0 for ti_state in TaskInstanceState},
            **{ti_state or "no_status": sum_value for ti_state, sum_value in task_instance_states},
        },
    }

    return HistoricalMetricDataResponse.model_validate(historical_metrics_response)


@dashboard_router.get(
    "/dag_stats",
    dependencies=[Depends(requires_access_dag(method="GET"))],
)
def dag_stats(
    session: SessionDep,
    readable_dags_filter: ReadableDagsFilterDep,
) -> DashboardDagStatsResponse:
    """Return basic DAG stats with counts of DAGs in various states."""
    permitted_dag_ids = cast("set[str]", readable_dags_filter.value)
    latest_dates_subq = (
        select(DagRun.dag_id, func.max(DagRun.logical_date).label("max_logical_date"))
        .where(DagRun.logical_date.is_not(None))
        .where(DagRun.dag_id.in_(permitted_dag_ids))
        .group_by(DagRun.dag_id)
        .subquery()
    )

    # Active Dags need another query from DagModel, as a Dag may not have any runs but still be active
    active_count_query = (
        select(func.count())
        .select_from(DagModel)
        .where(DagModel.is_stale == false())
        .where(DagModel.is_paused == false())
        .where(DagModel.dag_id.in_(permitted_dag_ids))
    )
    active_count = session.execute(active_count_query).scalar_one()

    # Other metrics are based on latest DagRun states
    latest_runs_cte = (
        select(
            DagModel.dag_id,
            DagModel.is_paused,
            DagRun.state,
        )
        .join(DagModel, DagRun.dag_id == DagModel.dag_id)
        .join(
            latest_dates_subq,
            (DagRun.dag_id == latest_dates_subq.c.dag_id)
            & (DagRun.logical_date == latest_dates_subq.c.max_logical_date),
        )
        .where(DagModel.is_stale == false())
        .where(DagRun.dag_id.in_(permitted_dag_ids))
        .cte()
    )
    combined_runs_query = select(
        func.coalesce(func.sum(case((latest_runs_cte.c.state == DagRunState.FAILED, 1))), 0).label("failed"),
        func.coalesce(func.sum(case((latest_runs_cte.c.state == DagRunState.RUNNING, 1))), 0).label(
            "running"
        ),
        func.coalesce(func.sum(case((latest_runs_cte.c.state == DagRunState.QUEUED, 1))), 0).label("queued"),
    ).select_from(latest_runs_cte)

    counts = session.execute(combined_runs_query).one()

    return DashboardDagStatsResponse(
        active_dag_count=active_count,
        failed_dag_count=counts.failed,
        running_dag_count=counts.running,
        queued_dag_count=counts.queued,
    )


@dashboard_router.get(
    "/flowrate_summary",
    dependencies=[Depends(requires_access_dag(method="GET"))],
)
def flowrate_summary(
    session: SessionDep,
    start_date: DateTimeQuery,
    readable_dags_filter: ReadableDagsFilterDep,
    end_date: OptionalDateTimeQuery = None,
) -> FlowRateSummaryResponse:
    """Return aggregated FlowRate metrics for the dashboard summary cards."""
    flowrate_configuration = _load_flowrate_configuration()
    if not flowrate_configuration.enabled:
        return FlowRateSummaryResponse(
            total_estimated_cost=0.0,
            tasks_tracked=0,
            average_cost_per_dag_run=0.0,
            resource_split=FlowRateSummaryResourceSplit(
                cpu_percentage=0.0,
                memory_percentage=0.0,
            ),
        )

    current_time = timezone.utcnow()
    retention_start_date = current_time - timedelta(days=flowrate_configuration.retention_days)
    effective_start_date = max(start_date, retention_start_date)
    permitted_dag_ids = cast("set[str]", readable_dags_filter.value)

    flowrate_filters = (
        FlowRateMetric.dag_id.in_(permitted_dag_ids),
        func.coalesce(FlowRateMetric.start_date, current_time) >= effective_start_date,
        func.coalesce(FlowRateMetric.end_date, current_time) <= func.coalesce(end_date, current_time),
    )

    distinct_dag_runs = (
        select(FlowRateMetric.dag_id, FlowRateMetric.run_id)
        .where(*flowrate_filters)
        .distinct()
        .subquery()
    )

    summary = session.execute(
        select(
            func.coalesce(func.sum(FlowRateMetric.estimated_cost), 0.0).label("total_estimated_cost"),
            func.count(FlowRateMetric.id).label("tasks_tracked"),
            select(func.count()).select_from(distinct_dag_runs).scalar_subquery().label("dag_run_count"),
            func.coalesce(func.sum(FlowRateMetric.cpu_seconds), 0.0).label("total_cpu_seconds"),
            func.coalesce(func.sum(FlowRateMetric.max_rss_mb), 0.0).label("total_memory_mb"),
        )
        .where(*flowrate_filters)
    ).one()

    average_cost_per_dag_run = (
        summary.total_estimated_cost / summary.dag_run_count if summary.dag_run_count else 0.0
    )

    total_resource = summary.total_cpu_seconds + summary.total_memory_mb
    cpu_percentage = summary.total_cpu_seconds / total_resource * 100 if total_resource else 0.0
    memory_percentage = 100.0 - cpu_percentage if total_resource else 0.0

    return FlowRateSummaryResponse(
        total_estimated_cost=round(float(summary.total_estimated_cost), 2),
        tasks_tracked=summary.tasks_tracked,
        average_cost_per_dag_run=round(float(average_cost_per_dag_run), 2),
        resource_split=FlowRateSummaryResourceSplit(
            cpu_percentage=round(float(cpu_percentage), 1),
            memory_percentage=round(float(memory_percentage), 1),
        ),
    )


@dashboard_router.get(
    "/flowrate_trends",
    dependencies=[Depends(requires_access_dag(method="GET"))],
)
def flowrate_trends(
    session: SessionDep,
    start_date: DateTimeQuery,
    readable_dags_filter: ReadableDagsFilterDep,
    end_date: OptionalDateTimeQuery = None,
) -> FlowRateTrendsResponse:
    """Return FlowRate trends data for top DAG and task visualizations."""
    flowrate_configuration = _load_flowrate_configuration()
    cpu_price_per_core_hour = flowrate_configuration.cpu_price_per_core_hour
    memory_price_per_gib_hour = flowrate_configuration.memory_price_per_gib_hour
    if not flowrate_configuration.enabled:
        return FlowRateTrendsResponse(
            pricing=FlowRateTrendsPricing(
                cpu_price_per_core_hour=round(float(cpu_price_per_core_hour), 6),
                memory_price_per_gib_hour=round(float(memory_price_per_gib_hour), 6),
            ),
            resource_split=FlowRateTrendsResourceSplit(
                cpu_cost=0.0,
                memory_cost=0.0,
                cpu_percentage=0.0,
                memory_percentage=0.0,
            ),
            top_dags=[],
            top_tasks=[],
        )

    current_time = timezone.utcnow()
    retention_start_date = current_time - timedelta(days=flowrate_configuration.retention_days)
    effective_start_date = max(start_date, retention_start_date)
    permitted_dag_ids = cast("set[str]", readable_dags_filter.value)

    flowrate_filters = (
        FlowRateMetric.dag_id.in_(permitted_dag_ids),
        func.coalesce(FlowRateMetric.start_date, current_time) >= effective_start_date,
        func.coalesce(FlowRateMetric.end_date, current_time) <= func.coalesce(end_date, current_time),
    )

    top_dag_totals = session.execute(
        select(
            FlowRateMetric.dag_id,
            func.coalesce(func.sum(FlowRateMetric.estimated_cost), 0.0).label("total_cost"),
            func.count(func.distinct(FlowRateMetric.run_id)).label("run_count"),
        )
        .where(*flowrate_filters)
        .group_by(FlowRateMetric.dag_id)
        .order_by(func.coalesce(func.sum(FlowRateMetric.estimated_cost), 0.0).desc())
        .limit(TOP_DAGS_LIMIT)
    ).all()

    top_dag_ids = [row.dag_id for row in top_dag_totals]

    dag_duration_rows = []
    if top_dag_ids:
        dag_duration_rows = session.execute(
            select(FlowRateMetric.dag_id, FlowRateMetric.start_date, FlowRateMetric.end_date)
            .where(*flowrate_filters)
            .where(FlowRateMetric.dag_id.in_(top_dag_ids))
        ).all()

    duration_by_dag: dict[str, list[float]] = defaultdict(list)
    for row in dag_duration_rows:
        duration_by_dag[row.dag_id].append(_duration_seconds(row.start_date, row.end_date))

    running_dags: set[str] = set()
    if top_dag_ids:
        running_dags = set(
            session.scalars(
                select(DagRun.dag_id)
                .where(DagRun.dag_id.in_(top_dag_ids))
                .where(DagRun.state.in_([DagRunState.RUNNING, DagRunState.QUEUED]))
                .distinct()
            ).all()
        )

    top_dags = [
        FlowRateTrendsDagCostRow(
            dag_id=row.dag_id,
            runs=int(row.run_count),
            avg_duration_seconds=round(float(_average(duration_by_dag[row.dag_id])), 2),
            status="running" if row.dag_id in running_dags else "success",
            estimated_cost=round(float(row.total_cost), 2),
        )
        for row in top_dag_totals
    ]

    top_task_totals = session.execute(
        select(
            FlowRateMetric.dag_id,
            FlowRateMetric.task_id,
            func.coalesce(func.sum(FlowRateMetric.estimated_cost), 0.0).label("total_cost"),
            func.count(FlowRateMetric.id).label("run_count"),
            func.coalesce(func.avg(FlowRateMetric.cpu_seconds), 0.0).label("avg_cpu_seconds"),
            func.coalesce(func.avg(FlowRateMetric.max_rss_mb), 0.0).label("avg_max_rss_mb"),
        )
        .where(*flowrate_filters)
        .group_by(FlowRateMetric.dag_id, FlowRateMetric.task_id)
        .order_by(func.coalesce(func.sum(FlowRateMetric.estimated_cost), 0.0).desc())
        .limit(TOP_TASKS_LIMIT)
    ).all()

    task_pairs = [(row.dag_id, row.task_id) for row in top_task_totals]

    duration_by_task: dict[tuple[str, str], list[float]] = defaultdict(list)
    if task_pairs:
        pair_filters = [
            and_(FlowRateMetric.dag_id == dag_id, FlowRateMetric.task_id == task_id)
            for dag_id, task_id in task_pairs
        ]
        task_duration_rows = session.execute(
            select(
                FlowRateMetric.dag_id,
                FlowRateMetric.task_id,
                FlowRateMetric.start_date,
                FlowRateMetric.end_date,
            )
            .where(*flowrate_filters)
            .where(or_(*pair_filters))
        ).all()
        for row in task_duration_rows:
            duration_by_task[(row.dag_id, row.task_id)].append(_duration_seconds(row.start_date, row.end_date))

    top_tasks = [
        FlowRateTrendsTaskCostRow(
            task_id=row.task_id,
            dag_id=row.dag_id,
            operator=None,
            avg_duration_seconds=round(float(_average(duration_by_task[(row.dag_id, row.task_id)])), 2),
            avg_cpu_seconds=round(float(row.avg_cpu_seconds), 2),
            avg_max_rss_mb=round(float(row.avg_max_rss_mb), 2),
            avg_cost_per_run=round(float(row.total_cost) / row.run_count, 2) if row.run_count else 0.0,
        )
        for row in top_task_totals
    ]

    resource_rows = session.execute(
        select(
            FlowRateMetric.cpu_seconds,
            FlowRateMetric.max_rss_mb,
            FlowRateMetric.start_date,
            FlowRateMetric.end_date,
        ).where(*flowrate_filters)
    ).all()

    cpu_cost = 0.0
    memory_cost = 0.0
    for row in resource_rows:
        duration_hours = _duration_seconds(row.start_date, row.end_date) / 3600.0
        if row.cpu_seconds:
            cpu_cost += (float(row.cpu_seconds) / 3600.0) * cpu_price_per_core_hour
        if row.max_rss_mb and duration_hours > 0:
            memory_cost += (float(row.max_rss_mb) / 1024.0) * duration_hours * memory_price_per_gib_hour

    total_resource_cost = cpu_cost + memory_cost
    cpu_percentage = (cpu_cost / total_resource_cost * 100.0) if total_resource_cost else 0.0
    memory_percentage = 100.0 - cpu_percentage if total_resource_cost else 0.0

    return FlowRateTrendsResponse(
        pricing=FlowRateTrendsPricing(
            cpu_price_per_core_hour=round(float(cpu_price_per_core_hour), 6),
            memory_price_per_gib_hour=round(float(memory_price_per_gib_hour), 6),
        ),
        resource_split=FlowRateTrendsResourceSplit(
            cpu_cost=round(float(cpu_cost), 2),
            memory_cost=round(float(memory_cost), 2),
            cpu_percentage=round(float(cpu_percentage), 1),
            memory_percentage=round(float(memory_percentage), 1),
        ),
        top_dags=top_dags,
        top_tasks=top_tasks,
    )
