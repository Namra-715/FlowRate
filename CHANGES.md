# FlowRate: Sprint 4 - Cost Aggregation Changes

**Branch**: `sprint4-cost-aggregation` (based on `sprint4-costengine`)

## Overview

Added DB-backed aggregation query functions to the FlowRate persistence layer and comprehensive unit tests for both the cost engine and aggregation logic. These functions query the existing `flowrate_metric` table on the fly — no new tables or migrations needed. The frontend analytics dashboard can call these directly to render cost insights.

---

## Files Changed

### 1. `airflow-core/src/airflow/plugins/flowrate/persistence.py` (modified, +149 lines)

Added 5 new `@provide_session` query functions. All are gated by `_is_flowrate_enabled()` and follow the same patterns as the existing `save_task_metric()`.


| Function                                                | SQL Logic                                                                       | Returns                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `get_task_costs(dag_id, run_id)`                        | `SELECT * FROM flowrate_metric WHERE dag_id=? AND run_id=? ORDER BY start_date` | `list[FlowRateMetric]`                                           |
| `get_dag_run_cost(dag_id, run_id)`                      | `SELECT SUM(estimated_cost) WHERE dag_id=? AND run_id=?`                        | `float | None`                                                   |
| `get_dag_costs_by_window(dag_id, start_time, end_time)` | `SELECT SUM(estimated_cost), COUNT(*) WHERE dag_id=? AND start_date BETWEEN ?`  | `dict` with `total_cost`, `task_count`, window bounds            |
| `get_top_expensive_dags(start_time, end_time, limit)`   | `GROUP BY dag_id ORDER BY SUM(estimated_cost) DESC LIMIT ?`                     | `list[dict]` with `dag_id`, `total_cost`, `task_count`           |
| `get_top_expensive_tasks(start_time, end_time, limit)`  | `GROUP BY (dag_id, task_id) ORDER BY SUM(estimated_cost) DESC LIMIT ?`          | `list[dict]` with `dag_id`, `task_id`, `total_cost`, `run_count` |


New imports added: `Any` from `typing`, `func` and `select` from `sqlalchemy`.

### 2. `airflow-core/tests/unit/plugins/flowrate/test_persistence.py` (modified, +158 lines)

Added 10 new tests + 1 helper function for the aggregation queries.

**Helper**: `_insert_metric(session, dag_id, run_id, task_id, estimated_cost, ...)` — convenience wrapper to reduce boilerplate in test setup.


| Test                                                   | Verifies                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `test_get_task_costs_returns_rows_for_run`             | Returns correct rows for a run, ignores other runs          |
| `test_get_task_costs_empty_for_nonexistent_run`        | Returns `[]` when no data                                   |
| `test_get_dag_run_cost_sums_correctly`                 | 1.5 + 2.5 = 4.0                                             |
| `test_get_dag_run_cost_returns_none_for_no_data`       | Returns `None` for missing run                              |
| `test_get_dag_costs_by_window_filters_correctly`       | Includes in-window rows, excludes out-of-window             |
| `test_get_dag_costs_by_window_returns_none_when_empty` | Returns `None` when no match                                |
| `test_get_top_expensive_dags_ordering_and_limit`       | Descending cost order, limit respected                      |
| `test_get_top_expensive_dags_empty`                    | Returns `[]` for empty table                                |
| `test_get_top_expensive_tasks_ordering_and_limit`      | Groups by (dag_id, task_id), correct ordering and run_count |
| `test_get_top_expensive_tasks_empty`                   | Returns `[]` for empty table                                |


### 3. `airflow-core/tests/unit/plugins/flowrate/test_cost_engine.py` (new file, 353 lines)

New test file with 30 unit tests covering cost engine functions from `cost_engine.py` that had no existing tests.


| Test Class                         | Function Tested                      | Tests                                                                                   |
| ---------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `TestEstimateCost`                 | `estimate_cost()`                    | 7 — cpu-only, memory-only, both, zero duration, negative duration, both-None, half-hour |
| `TestEstimateCostFromUsageMetrics` | `estimate_cost_from_usage_metrics()` | 5 — cpu-only, memory-only, both, zero duration, all-None                                |
| `TestEstimateCostAuto`             | `estimate_cost_auto()`               | 2 — all-None returns None, zero duration returns 0.0                                    |
| `TestParseCpuToCores`              | `_parse_cpu_to_cores()`              | 6 — "500m", "1", "2000m", empty, whitespace, "0.25"                                     |
| `TestParseMemoryToGib`             | `_parse_memory_to_gib()`             | 6 — "512Mi", "1Gi", "1048576Ki", "1Ti", empty, raw bytes                                |
| `TestFloorToWindow`                | `floor_to_window()`                  | 4 — 60min, 15min, exact boundary, 1min                                                  |
| `TestAggregateCostsByTimeWindow`   | `aggregate_costs_by_time_window()`   | 4 — normal bucketing, empty, missing fields skipped, sorted                             |
| `TestSafeRound`                    | `safe_round()`                       | 4 — normal, None, NaN, inf                                                              |


---

## What Was NOT Changed

- `cost_engine.py` — untouched (already complete on `sprint4-costengine`)
- `flowrate_metric.py` model — untouched
- `config.yml` — untouched
- `task_instances.py` execution API wiring — untouched
- No new database tables or migrations

---

## How the Frontend Will Use These

The aggregation functions are designed to be called from API endpoints that the FlowRate dashboard will consume:

```
Dashboard Widget          ->  Function to call
─────────────────────────────────────────────────
Top Expensive DAGs        ->  get_top_expensive_dags(start, end, limit)
Top Expensive Tasks       ->  get_top_expensive_tasks(start, end, limit)
DAG Run Cost Detail       ->  get_dag_run_cost(dag_id, run_id)
Task Breakdown for a Run  ->  get_task_costs(dag_id, run_id)
DAG Cost Over Time        ->  get_dag_costs_by_window(dag_id, start, end)
```

Per-task cost rows are written by `persist_estimated_ti_cost()` (in `cost_engine.py`) whenever a task completes. These aggregation functions read from that same `flowrate_metric` table on the fly — no pre-computed aggregation tables needed.