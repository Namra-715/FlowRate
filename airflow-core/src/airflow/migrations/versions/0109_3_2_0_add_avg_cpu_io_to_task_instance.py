#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use it except in compliance
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

"""
Add avg_cpu_cores, read_bytes, write_bytes to task_instance and task_instance_history.

Revision ID: a2b3c4d5e6f7
Revises: b1c8d9e0f1a2
Create Date: 2026-03-14

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a2b3c4d5e6f7"
down_revision = "b1c8d9e0f1a2"
branch_labels = None
depends_on = None
airflow_version = "3.2.0"


def upgrade():
    """Add avg_cpu_cores, read_bytes, write_bytes to task_instance and task_instance_history."""
    with op.batch_alter_table("task_instance", schema=None) as batch_op:
        batch_op.add_column(sa.Column("avg_cpu_cores", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("read_bytes", sa.BigInteger(), nullable=True))
        batch_op.add_column(sa.Column("write_bytes", sa.BigInteger(), nullable=True))

    with op.batch_alter_table("task_instance_history", schema=None) as batch_op:
        batch_op.add_column(sa.Column("avg_cpu_cores", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("read_bytes", sa.BigInteger(), nullable=True))
        batch_op.add_column(sa.Column("write_bytes", sa.BigInteger(), nullable=True))


def downgrade():
    """Remove avg_cpu_cores, read_bytes, write_bytes."""
    with op.batch_alter_table("task_instance_history", schema=None) as batch_op:
        batch_op.drop_column("write_bytes")
        batch_op.drop_column("read_bytes")
        batch_op.drop_column("avg_cpu_cores")

    with op.batch_alter_table("task_instance", schema=None) as batch_op:
        batch_op.drop_column("write_bytes")
        batch_op.drop_column("read_bytes")
        batch_op.drop_column("avg_cpu_cores")
