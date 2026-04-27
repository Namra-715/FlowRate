/*!
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

export const formatFlowRateCost = (cost: number | null | undefined): string => {
  if (cost === null || cost === undefined) {
    return "—";
  }

  if (cost === 0) {
    return "$0.00";
  }

  if (Math.abs(cost) < 0.01) {
    return `$${cost.toFixed(6)}`;
  }

  return `$${cost.toFixed(2)}`;
};

export const formatMinutesSeconds = (durationSeconds: number | null | undefined): string => {
  if (durationSeconds === null || durationSeconds === undefined) {
    return "—";
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
};
