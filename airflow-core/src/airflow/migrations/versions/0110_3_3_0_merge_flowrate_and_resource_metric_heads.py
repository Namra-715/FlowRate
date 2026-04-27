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

"""Merge FlowRate and resource metric migration heads.

Revision ID: c3d4e5f6a7b8
Revises: a2b3c4d5e6f7, 9f3b2c1d4e5f
Create Date: 2026-04-20 19:45:00.000000
"""

from __future__ import annotations
from alembic import op

revision = "c3d4e5f6a7b8"
down_revision = ("a2b3c4d5e6f7", "9f3b2c1d4e5f")
branch_labels = None
depends_on = None
airflow_version = "3.3.0"


def upgrade():
    """Merge two migration branches without schema changes."""

def downgrade():
    """Downgrade is a no-op for merge revisions."""

