# FlowRate Maintainer's Manual

**Project:** FlowRate for Apache Airflow  
**Course:** CS 5150, Spring 2026, Cornell University  
**Client:** Apache Airflow / TA Kabir Samsi, Cornell CIS  
**Team:** Namra Shah, Sai Vamsi Allada, Ayan Kohli, Jessica Andrews, Sophie Wang

## Overview

FlowRate adds resource usage and estimated cost visibility to Apache Airflow. For DAGs that opt in, FlowRate records task-level CPU time, peak memory, average CPU cores, and disk I/O, then shows cost summaries in the Airflow UI. 

FlowRate appears in three places:

- **Home page:** summary cards for total estimated cost, tasks tracked, average cost per DAG run, and CPU/memory split
- **Trends page:** detailed cost trends, top DAGs, top tasks, resource split, and pricing basis
- **Admin menu:** FlowRate configuration for enablement and pricing


Main capabilities delivered:

- Per-DAG opt-in through `enable_cost_metrics=True`.
- Task resource collection for CPU seconds, peak RSS memory, average CPU cores, and disk I/O.
- Metric persistence in the `flowrate_metric` table.
- Estimated task and DAG run cost.
- Home page cost summary.
- Trends page with daily costs, top DAGs, top tasks, resource split, and pricing basis.
- Admin configuration for enablement and pricing.
- Demo DAG for local validation.

## Requirements Analysis and Specification

### Functional Requirements

The original project proposal focused on Kubernetes-based resource attribution. During implementation, our team and client narrowed the final delivery to an Airflow-native implementation that measures local task resource usage, estimates cost from those measurements, and exposes the results in the Airflow UI.

| ID | Preliminary Requirement | Final Status |
|---|---|---|
| FR-1 | Our system will attribute each Airflow task instance to a corresponding Kubernetes execution unit while running under a Kubernetes-based execution pattern | Revised with client approval. The final implementation attributes metrics directly to Airflow task instances through the Task SDK runtime path. Kubernetes pod attribution is not included in this release. |
| FR-2 | Our system will capture task execution timing for each task instance | Delivered |
| FR-3 | Our system will obtain per-task resource request values (CPU, memory) from the Kubernetes pod specification for the attributed unit | Revised with client approval. The final implementation measures CPU seconds, peak RSS memory, average CPU cores, and disk I/O from the task process instead of reading Kubernetes pod requests. |
| FR-4 | Our system will compute an estimated cost for each task instance using: runtime duration, requested resources, and user-configurable pricing parameters (e.g. $ per GB per hour) | Delivered with revised inputs. See above for how cost is computed. |
| FR-5 | Our system will aggregate estimated costs and runtime both per DAG run (by summing across tasks in a run) and per DAG over a selected time window (e.g. last 24 hours) | Delivered |
| FR-6 | Our system will persist task-level and aggregated metrics in a database table for up to one week so that results remain available after task completion and restarts | Partially delivered. Task-level FlowRate rows are persisted in `flowrate_metric`, but there is no automatic cleanup job for old rows yet. |
| FR-7 | Our system will provide a FlowRate analytics view accessible from the Airflow UI that shall display a KPI summary including: total estimated cost, count of tasks tracked, average cost per DAG run, and the percentage split between CPU cost and memory cost, all scoped to a user-selected time window. | Delivered |
| FR-8 | The analytics view shall provide a trend views including: top DAGs ranked by total estimated cost, top tasks ranked by average cost per run, a daily cost trend over a selected date range, and a per-DAG cost breakdown table. | Delivered |
| FR-9 | Our system will provide a configuration mechanism to enable/disable FlowRate and set pricing parameter (disabled by default) | Delivered |

### Non-Functional Requirements
| ID | Preliminary Requirement | Final Status |
|---|---|---|
| NFR-1 | FlowRate is opt-in and additive. Existing DAGs should continue to run normally. | Delivered |
| NFR-2 | The dashboard UI should respond to user interactions within a time consistent with the existing Airflow UI (no perceptible increase in page load time relative to non-FlowRate dashboard tabs). | Delivered |

## System Architecture

FlowRate follows Airflow's existing execution boundaries. DAG authors opt into metrics by setting `enable_cost_metrics=True`. When an opted-in task runs, the Task SDK runtime collector records process-level resource usage such as CPU seconds, peak RSS memory, average CPU cores, and disk I/O. When the task reaches a terminal state, those metrics are sent through Airflow's existing Execution API path instead of bypassing Airflow's normal worker-to-API communication model.

On the backend, the API server stores the resource fields on the task instance and writes a corresponding `flowrate_metric` row in the metadata database. The FlowRate cost engine uses the stored runtime metrics and configured CPU/memory prices to estimate task cost. Dashboard endpoints then aggregate those persisted rows by DAG, task, run, and time window. The React UI reads those endpoints to render the home page summary, Trends page, configuration page, DAG list cost values, and run/task-level metric views.

## Important Files

### Task SDK and Runtime Metrics

| Path | Purpose |
|---|---|
| `task-sdk/src/airflow/sdk/definitions/dag.py` | Adds or carries the `enable_cost_metrics` DAG flag |
| `task-sdk/src/airflow/sdk/execution_time/resource_metrics.py` | Collects CPU, memory, average core, and I/O metrics |
| `task-sdk/src/airflow/sdk/execution_time/task_runner.py` | Attaches metrics to terminal task state payloads |
| `task-sdk/src/airflow/sdk/execution_time/supervisor.py` | Propagates terminal metrics from task execution to API client calls |
| `task-sdk/src/airflow/sdk/execution_time/comms.py` | Defines task execution messages that can carry metric fields |

### Backend API, Model, and Cost Logic

| Path | Purpose |
|---|---|
| `airflow-core/src/airflow/models/flowrate_metric.py` | SQLAlchemy model for persisted FlowRate metric rows |
| `airflow-core/src/airflow/migrations/versions/0108_3_3_0_add_flowrate_metric_table.py` | Alembic migration for `flowrate_metric` |
| `airflow-core/src/airflow/plugins/flowrate/cost_engine.py` | Pricing lookup and cost estimation |
| `airflow-core/src/airflow/plugins/flowrate/persistence.py` | Metric persistence and aggregation helpers |
| `airflow-core/src/airflow/api_fastapi/execution_api/routes/task_instances.py` | Receives terminal task metrics and triggers FlowRate persistence |
| `airflow-core/src/airflow/api_fastapi/core_api/routes/ui/dashboard.py` | Dashboard summary, trends, cost trends, and configuration endpoints |
| `airflow-core/src/airflow/api_fastapi/core_api/datamodels/ui/dashboard.py` | Response/request models for FlowRate dashboard APIs |

### Frontend

| Path | Purpose |
|---|---|
| `airflow-core/src/airflow/ui/src/pages/Dashboard/MetricSummary.tsx` | Home page FlowRate KPI cards |
| `airflow-core/src/airflow/ui/src/pages/FlowRateTrends.tsx` | Dedicated Trends navbar page |
| `airflow-core/src/airflow/ui/src/pages/Dashboard/FlowRateTrendsBottomSection.tsx` | Trends query state, refresh behavior, and composed visual sections |
| `airflow-core/src/airflow/ui/src/pages/Dashboard/CostTrends.tsx` | Daily cost chart and per-DAG cost table |
| `airflow-core/src/airflow/ui/src/pages/Dashboard/FlowRateTrendsTopDagsAndResources.tsx` | Top DAGs, resource split, and pricing basis cards |
| `airflow-core/src/airflow/ui/src/pages/Dashboard/FlowRateTrendsTopTasksCard.tsx` | Top tasks table and DAG filter |
| `airflow-core/src/airflow/ui/src/pages/Dashboard/FlowRateConfigurationSection.tsx` | FlowRate configuration UI |
| `airflow-core/src/airflow/ui/src/queries/useFlowRateSummary.ts` | React Query hook for summary API |
| `airflow-core/src/airflow/ui/src/queries/useFlowRateTrends.ts` | React Query hook for trends API |
| `airflow-core/src/airflow/ui/src/queries/useFlowRateConfiguration.ts` | React Query hook and mutation for configuration API |

### Demo

| Path | Purpose |
|---|---|
| `dev/airflow_perf/dags/flowrate_demo_dag.py` | Demo DAG used in Breeze/local validation |

## Data Model

`FlowRateMetric` stores one metric row for a task completion event.

```text
TaskInstance
  - cpu_seconds
  - max_rss_mb
  - avg_cpu_cores
  - read_bytes
  - write_bytes
```

Terminal metrics are copied when the task finishes.

```
FlowRateMetric
  - id
  - dag_id
  - run_id
  - task_id
  - start_date
  - end_date
  - cpu_seconds
  - max_rss_mb
  - avg_cpu_cores
  - read_bytes
  - write_bytes
  - estimated_cost
```

Cost calculation uses configured prices.
```
FlowRatePricing
  - cpu_price_per_core_hour
  - memory_price_per_gib_hour
```
Values are provided by the saved admin configuration.
```
FlowRateConfiguration
  - enabled
  - retention_days
  - cpu_price_per_core_hour
  - memory_price_per_gib_hour
```

Important notes:

- The current release does not automatically delete old rows (`retention_days` is stored for retention behavior, but no cleanup job is implemented)
- Cost is based on CPU and memory. Disk I/O is collected but not priced.

## Endpoint Reference

FlowRate UI endpoints live under the dashboard UI router.

| Endpoint | Purpose |
|---|---|
| `GET /ui/dashboard/flowrate_configuration` | Read saved FlowRate UI configuration |
| `PUT /ui/dashboard/flowrate_configuration` | Save FlowRate UI configuration |
| `GET /ui/dashboard/flowrate_summary` | Return total cost, task count, average cost per run, and CPU/memory split for a requested window |
| `GET /ui/dashboard/flowrate_trends` | Return top DAGs, top tasks, resource split, and pricing basis for a requested window |
| `GET /ui/dashboard/cost_trends` | Return daily cost totals and per-DAG daily cost summaries |


Dashboard read endpoints must only expose data for DAGs the user can read.


## Cost Calculation

Current task cost formula:

```text
cpu_cost = cpu_seconds / 3600 * cpu_price_per_core_hour
mem_cost = max_rss_mb / 1024 * duration_hours * memory_price_per_gib_hour
estimated_cost = cpu_cost + mem_cost
```

Pricing sources:

1. UI-saved configuration in the Airflow Variable `flowrate.ui.configuration`
2. Fallback values from `[flowrate]` config

These values are estimates for observability and optimization. They are not cloud-provider billing records.

## Final User Interface Design

Final UI designs are in Figma:

[UI](https://www.figma.com/design/1SkuWdtCaO0RKJqm4CcyeD/UI?node-id=0-1&p=f&t=tqAf5g8AtsS1d6ft-0)

Implemented UI surfaces:

- Home page FlowRate summary cards
- Trends navbar page
- FlowRate Configuration page under the Admin menu
- DAGs list estimated cost value
- Run and task views with resource metrics

Intent:

- Keep FlowRate integrated with native Airflow UI instead of building a separate dashboard
- Make the Trends page the primary investigation view
- Make configuration explicit and administrator-oriented

## Deployment Procedure

### Prerequisites

- Apache Airflow running through Breeze or another development environment
- Docker running locally
- Access to the Airflow web UI
- FlowRate code present in the Airflow checkout

### Install Breeze

On macOS:

```bash
brew install --cask docker
curl -LsSf https://astral.sh/uv/install.sh | sh
uv tool install -e ./dev/breeze
uv tool install prek
prek install -f
prek install -f --hook-type pre-push
```

On Windows, use WSL2 with Ubuntu. Install Docker Desktop, enable WSL integration, then run the same commands inside the Ubuntu/WSL shell:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv tool install -e ./dev/breeze
uv tool install prek
prek install -f
prek install -f --hook-type pre-push
```

### Start Airflow

Terminal 1:

```bash
cd FlowRate
breeze start-airflow
```

Be mindful that this may take some time on first start. Open the UI while Breeze is running:

```text
http://localhost:28080
```

Default login:

```text
username: admin
password: admin
```
or whatever is provided to you in the terminal.

### Optional: Load the Provided Demo DAG

Use this if the provided demo DAG does not appear automatically.

Terminal 2:

```bash
docker ps
```

Find the container name that looks like `breeze-airflow-run-[ID]`, then run:

```bash
docker exec -it [run ID] bash
mkdir -p /root/airflow/dags
mkdir -p /files/dags
cp /opt/airflow/dev/airflow_perf/dags/flowrate_demo_dag.py /root/airflow/dags/
cp /opt/airflow/dev/airflow_perf/dags/flowrate_demo_dag.py /files/dags/
airflow dags reserialize
```

To confirm that the demo DAG loaded, run:

```bash
airflow dags list | grep flowrate_demo_dag
```

Then, return to the UI, search for `flowrate_demo_dag`, trigger it, and check the FlowRate views after the run completes.

Then enable FlowRate in the UI, trigger the DAG, and inspect the home page, DAGs list, run page, task metrics, and Trends page.

### Database Migration

FlowRate requires the Alembic migration that creates `flowrate_metric`. For deployment, run Airflow's normal database migration process for that environment. In local Breeze work, execute Airflow commands inside Breeze rather than directly on the host.

### Configuration


FlowRate can also be configured in `airflow.cfg` or with environment variables:

```ini
[flowrate]
enabled = True
cpu_price_per_core_hour = 0.048
memory_price_per_gib_hour = 0.006
```

```bash
AIRFLOW__FLOWRATE__ENABLED=True
AIRFLOW__FLOWRATE__CPU_PRICE_PER_CORE_HOUR=0.048
AIRFLOW__FLOWRATE__MEMORY_PRICE_PER_GIB_HOUR=0.006
```

In order, runtime persistence honors the environment variable, then `airflow.cfg`, then the UI-saved Airflow Variable (when config is not forcing FlowRate on).

Administrators can also use the FlowRate Configuration page in the UI.

## Test Facilities

Using Airflow's tooling.

### Backend Tests

Recommended targeted tests:

```bash
breeze run pytest airflow-core/tests/unit/plugins/flowrate/test_cost_engine.py -xvs
breeze run pytest airflow-core/tests/unit/plugins/flowrate/test_persistence.py -xvs
breeze run pytest airflow-core/tests/unit/api_fastapi/core_api/routes/ui/test_dashboard.py -xvs
breeze run pytest airflow-core/tests/unit/api_fastapi/execution_api/versions/head/test_task_instances.py -xvs
```

These tests cover:

- Cost formula behavior and rounding
- Persistence no-op behavior when disabled
- Persistence failure isolation
- Aggregation by DAG, task, run, and time window
- Dashboard summary/trends/configuration endpoints
- Execution API propagation of resource fields

### Frontend Checks

From `airflow-core/src/airflow/ui`:

```bash
pnpm exec tsc --p tsconfig.app.json
pnpm test
pnpm lint
```

During final handoff, targeted TypeScript checking passed after the Trends refresh and timeframe changes. Full UI lint might still surface style cleanup in unrelated FlowRate UI files. Treat that as cleanup work before using lint as the final release gate.

### Static Checks

From the repository root:

```bash
prek run --from-ref main --stage pre-commit
prek run --from-ref main --stage manual
```

For CI-style test selection:

```bash
breeze selective-checks --commit-ref <commit_with_squashed_changes>
```

### Manual Acceptance Test

Use this flow to reproduce the final demo:

1. Start Breeze
2. Optionally copy the demo DAG into the Breeze DAG folders using the commands above
3. Open `http://localhost:28080`
4. Log in with `admin` / `admin`
5. Open **Admin → FlowRate Configuration**
6. Enable FlowRate and set pricing parameters
7. Open **DAGs** and search for `flowrate_demo_dag`
8. Trigger the DAG
9. After it finishes, check the home page summary, DAGs list estimated cost, run details, task metrics, and Trends page

## Test Plan and Results

| Area | Intended coverage | Final status |
|---|---|---|
| Cost engine | CPU/memory formula, rounding, missing values | Implemented, but some tests may need cleanup to match final measured-usage API. |
| Persistence | Insert rows, no-op disabled state, failure isolation, aggregations | Implemented |
| Dashboard API | Summary, trends, config, auth failures | Implemented, but testing scope could be expanded. |
| Execution API | Metric fields accepted and stored on terminal task update | Implemented |
| React UI | Type safety, summary cards, Trends page, config page | Implemented, but broader UI lint cleanup remains. |
| End-to-end demo | Demo DAG produces visible FlowRate data | Validated |

User testing is also included in our test plan because this project involves UI changes, and technical correctness alone isn't sufficient. Users need to be able to understand, navigate, and realize the value of the new metrics. We ran usability sessions with three participants, asking each to complete a set of defined task flows. Throughout the sessions, we observed how users interacted with the platform, noting points of friction, moments of confusion, and where they got stuck. Each session closed with an open discussion where participants shared feedback on the clarity and usefulness of what they'd seen. See our report for results.

## Handoff Summary

FlowRate's core feature set is delivered. The main remaining work is stabilization. Maintainers should seek to reconcile tests with the final measured-usage implementation and clean up UI lint issues. They can also decide whether retention should become an automatic cleanup job, decide to include operator names in top task views, and look to expand executor coverage particularly to the KubernetesExecutor.

---

FlowRate Maintainer's Manual -
CS 5150
