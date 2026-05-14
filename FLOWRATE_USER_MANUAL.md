# FlowRate User Manual

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

Cost is estimated from measured task usage:

```text
CPU cost = cpu_seconds / 3600 * cpu_price_per_core_hour
Memory cost = peak_memory_gib * runtime_hours * memory_price_per_gib_hour
```

These values are estimates for observability and optimization. They are not cloud-provider billing records.

## User Roles

| Role | What they do with FlowRate |
|---|---|
| Administrator | Enables FlowRate, configures pricing, and verifies the deployment records metrics |
| DAG author | Adds `enable_cost_metrics=True` to DAGs that should be measured |
| Operator | Uses the home page, DAGs list, run views, and Trends page to identify expensive DAGs and tasks |
| Maintainer | Extends the metric pipeline, API routes, persistence layer, and UI. See `FLOWRATE_MAINTAINERS_MANUAL.md` |

## Setup

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

## Enabling FlowRate

FlowRate has two layers of enablement.

1. **Global enablement:** an administrator turns FlowRate on
2. **DAG opt-in:** a DAG author enables metrics for a specific DAG

### Enable Globally in the UI 

1. Open the Airflow UI
2. Open the **Admin** menu
3. Select **FlowRate Configuration**
4. Turn on **Enable FlowRate**
5. Set CPU and memory pricing
6. Click **Save**

### Enable Globally with Configuration

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

### Enable Metrics on a DAG

DAG authors opt in by setting `enable_cost_metrics=True`:

```python
from airflow.providers.standard.operators.python import PythonOperator
from airflow.sdk import DAG, timezone


def work():
    ...


with DAG(
    dag_id="example_flowrate_dag",
    start_date=timezone.datetime(2024, 1, 1),
    schedule=None,
    catchup=False,
    enable_cost_metrics=True,
    tags=["flowrate"],
) as dag:
    PythonOperator(
        task_id="example_task",
        python_callable=work,
    )
```

DAGs that do not opt in do not produce FlowRate metric rows or collected metrics. Existing non-FlowRate DAG behavior is unchanged. 

## Metric Reference

| Metric | Meaning |
|---|---|
| `cpu_seconds` | Total CPU time used by the task process tree (not wall-clock time, e.g. a task using 2 cores for 10 seconds will report about 20 CPU seconds) |
| `max_rss_mb` | Peak resident memory observed during task execution |
| `avg_cpu_cores` | Average CPU core utilization over the task lifetime |
| `read_bytes` / `write_bytes` | Disk I/O (not included in the cost formula) |
| `estimated_cost` | Approximate cost based on measured CPU, peak memory, runtime, and configured pricing |

## Core Use Cases

### Use Case 1: Run a DAG and View Per-Task Metrics

**Roles:** DAG author, operator

1. Enable FlowRate globally
2. Add `enable_cost_metrics=True` to the DAG
3. Trigger a new DAG run
4. Open the run after it completes
5. Review task metrics in the Task Instances table and task details

Per-task metrics include:

- CPU seconds
- Peak RSS memory
- Average CPU cores
- Read bytes and write bytes
- Estimated cost

If you see a missing value, the task may have failed before metrics could be collected or run in an unsupported environment. If no values appear, confirm that FlowRate is enabled in **Admin → FlowRate Configuration**.

### Use Case 2: View Estimated Cost for a DAG Run

**Roles:** operator

1. Open the DAG
2. Open a completed DAG run
3. Review the run-level metrics (same metrics for tasks, but accumulated)
4. Compare the run total with the per-task rows to identify which tasks drove the cost

The DAG run estimated cost is the sum of its task-level estimated costs.

### Use Case 3: Explore Trends

**Roles:** operator, administrator

1. Click **Trends** in the navbar
2. Select a timeframe: last 24 hours, last 7 days, or last 30 days
3. Review:
   - Daily estimated cost
   - Top DAGs by estimated cost
   - Top tasks by estimated cost
   - CPU vs. memory cost split
   - Current pricing basis
4. Use **Refresh** to fetch the latest metrics after a run
5. Use the DAG filter in the Top Tasks table to focus on one DAG 

### Use Case 4: Compare DAGs by Estimated Cost

**Roles:** operator

Use the DAGs list for a quick per-DAG cost signal. Or, use the Trends page for deeper comparison across a selected timeframe.

The DAGs list shows an estimated cost value for DAGs with FlowRate metrics. The Trends page aggregates costs over the selected time window, which may serve better for comparing repeated runs.

## Configurations

FlowRate configuration is available from the **Admin** menu under **FlowRate Configuration**.

| Setting | Meaning |
|---|---|
| Enable FlowRate | Turns global metric persistence and aggregation on or off |
| Retention Days | Stored for future retention behavior (current release does not automatically delete old `flowrate_metric` rows) |
| Cloud Pricing Profile | Presets that fill CPU and memory price inputs |
| CPU Price | Cost per vCPU-hour used in estimates |
| Memory Price | Cost per GB-hour used in estimates |
| Reserved CPU Fallback | Reserved for future fallback logic; inactive in this release |

Available UI pricing presets include GCP n2-standard, GCP e2-standard, AWS m5.large, AWS c5.large, Azure D2s v3, and Custom. Administrators should verify the saved pricing in FlowRate Configuration before interpreting cost numbers.

## Demo DAG Workflow

The demo DAG is intended for local validation. It allocates memory, performs some dummy CPU work with a counter, and reads/writes a temporary file. This provides FlowRate with some visible data to collect.

Demo DAG locations:

```text
dev/airflow_perf/dags/flowrate_demo_dag.py
airflow-local/dags/flowrate_demo_dag.py
```

Recommended demo flow:

1. Start Breeze
2. Optionally copy the demo DAG into the Breeze DAG folders using the commands above
3. Open `http://localhost:28080`
4. Log in with `admin` / `admin`
5. Open **Admin → FlowRate Configuration**
6. Enable FlowRate and set pricing parameters
7. Open **DAGs** and search for `flowrate_demo_dag`
8. Trigger the DAG
9. After it finishes, check the home page summary, DAGs list estimated cost, run details, task metrics, and Trends page

## Opting Out

To stop collecting new FlowRate metrics for a DAG, remove `enable_cost_metrics=True` or set it to `False`.

```python
with DAG(
    dag_id="my_pipeline",
    start_date=timezone.datetime(2026, 1, 1),
    schedule="@daily",
    enable_cost_metrics=False,
) as dag:
    ...
```

Existing metric rows remain in the database, and future runs of that DAG will not write new FlowRate metric rows. FlowRate is additive and opt-in.

## Known Limitations

| Limitation | Details |
|---|---|
| LocalExecutor-focused | FlowRate was validated for LocalExecutor-style local task processes, so other executors may need additional attribution work. |
| Estimated costs only | FlowRate estimates cost from measured usage and configured prices. It does not read actual cloud billing parameters. |
| Disk I/O is not priced | I/O metrics are collected and displayed for observability only. |
| No automatic cleanup job | `retention_days` is stored, but the current release does not automatically delete old rows from `flowrate_metric`. |

## Troubleshooting

### Metrics Do Not Appear

Check:

1. FlowRate is enabled in **Admin → FlowRate Configuration** or config
2. The DAG has `enable_cost_metrics=True`
3. A new run completed after the flag was added
4. The `flowrate_metric` table exists
5. The task ran in the supported local execution path

### Trends Page Shows No Data

Check:

1. At least one opted-in DAG completed in the selected timeframe
2. You have permission to read that DAG
3. The page has been refreshed
4. The demo DAG has been copied and reserialized if you are using the optional local demo path

### Cost Looks Too High or Too Low

Check the configured CPU and memory prices. Also review the metric reference to confirm what each value means.

### UI Unsynced with Code Changes

For frontend work, try:

```bash
breeze start-airflow --dev-mode
```

Open Airflow:

```text
http://localhost:28080
```

## Demo Video

Demo video: https://youtu.be/wO9kZ1qOsCA

---

FlowRate User Manual -
CS 5150