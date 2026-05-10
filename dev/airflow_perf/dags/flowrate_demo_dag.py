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
import os
import tempfile
import time
from airflow.providers.standard.operators.python import PythonOperator
from airflow.sdk import DAG, timezone


def _demo_task() -> None:
    # Allocate 32 MB block
    data = bytearray(32 * 1024 * 1024)
    
    # Counter
    total = 0

    # CPU heavy loop
    for index in range(2000000):
        total += index % 99

    fd, path = tempfile.mkstemp(prefix="flowrate-demo-", suffix=".bin")
    try:
        with os.fdopen(fd, "wb") as handle:
            # Write 32 MB data block to disk
            handle.write(data)
        with open(path, "rb") as handle:
            # Read 32 MB data block, already cached (not from disk)
            handle.read()
    finally:
        os.remove(path)

    time.sleep(1)
    print(f"FlowRate demo task finished with total={total}.")

with DAG(
    dag_id="flowrate_demo_dag",
    start_date=timezone.datetime(2024, 1, 1),
    schedule=None,
    catchup=False,
    enable_cost_metrics=True,
    tags=["flowrate", "demo"],
) as dag:
    PythonOperator(
        task_id="flowrate_demo_task",
        python_callable=_demo_task,
    )
