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

from airflow.api_fastapi.core_api.base import BaseModel


class DAGRunTypes(BaseModel):
    """DAG Run Types for responses."""

    backfill: int
    scheduled: int
    manual: int
    asset_triggered: int


class DAGRunStates(BaseModel):
    """DAG Run States for responses."""

    queued: int
    running: int
    success: int
    failed: int


class TaskInstanceStateCount(BaseModel):
    """TaskInstance serializer for responses."""

    no_status: int
    removed: int
    scheduled: int
    queued: int
    running: int
    success: int
    restarting: int
    failed: int
    up_for_retry: int
    up_for_reschedule: int
    upstream_failed: int
    skipped: int
    deferred: int


class HistoricalMetricDataResponse(BaseModel):
    """Historical Metric Data serializer for responses."""

    dag_run_types: DAGRunTypes
    dag_run_states: DAGRunStates
    task_instance_states: TaskInstanceStateCount


class DashboardDagStatsResponse(BaseModel):
    """Dashboard DAG Stats serializer for responses."""

    active_dag_count: int
    failed_dag_count: int
    running_dag_count: int
    queued_dag_count: int


class FlowRateSummaryResourceSplit(BaseModel):
    """FlowRate resource split serializer for responses."""

    cpu_percentage: float
    memory_percentage: float


class FlowRateSummaryResponse(BaseModel):
    """FlowRate dashboard summary serializer for responses."""

    total_estimated_cost: float
    tasks_tracked: int
    average_cost_per_dag_run: float
    resource_split: FlowRateSummaryResourceSplit


class FlowRateTrendsPricing(BaseModel):
    """FlowRate trends pricing metadata."""

    cpu_price_per_core_hour: float
    memory_price_per_gib_hour: float


class FlowRateTrendsResourceSplit(BaseModel):
    """FlowRate trends resource split serializer for responses."""

    cpu_cost: float
    memory_cost: float
    cpu_percentage: float
    memory_percentage: float


class FlowRateTrendsDagCostRow(BaseModel):
    """Top DAG row for FlowRate trends."""

    dag_id: str
    runs: int
    avg_duration_seconds: float
    status: str
    estimated_cost: float


class FlowRateTrendsTaskCostRow(BaseModel):
    """Top task row for FlowRate trends."""

    task_id: str
    dag_id: str
    operator: str | None
    avg_duration_seconds: float
    avg_cpu_seconds: float
    avg_max_rss_mb: float
    avg_cost_per_run: float


class FlowRateTrendsResponse(BaseModel):
    """FlowRate trends serializer for responses."""

    pricing: FlowRateTrendsPricing
    resource_split: FlowRateTrendsResourceSplit
    top_dags: list[FlowRateTrendsDagCostRow]
    top_tasks: list[FlowRateTrendsTaskCostRow]
