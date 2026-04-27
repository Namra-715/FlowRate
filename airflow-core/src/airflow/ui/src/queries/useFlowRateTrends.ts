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
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import dayjs, { type Dayjs } from "dayjs";

import { OpenAPI } from "openapi/requests/core/OpenAPI";
import type { FlowRateSummaryTimeframe } from "./useFlowRateSummary";

export type FlowRateTrendsResponse = {
  readonly pricing: {
    readonly cpu_price_per_core_hour: number;
    readonly memory_price_per_gib_hour: number;
  };
  readonly resource_split: {
    readonly cpu_cost: number;
    readonly memory_cost: number;
    readonly cpu_percentage: number;
    readonly memory_percentage: number;
  };
  readonly top_dags: Array<{
    readonly dag_id: string;
    readonly runs: number;
    readonly avg_duration_seconds: number;
    readonly status: string;
    readonly estimated_cost: number;
  }>;
  readonly top_tasks: Array<{
    readonly task_id: string;
    readonly dag_id: string;
    readonly operator: string | null;
    readonly avg_duration_seconds: number;
    readonly avg_cpu_seconds: number;
    readonly avg_max_rss_mb: number;
    readonly avg_cost_per_run: number;
  }>;
};

const subtractTimeframe = (value: Dayjs, timeframe: FlowRateSummaryTimeframe): Dayjs => {
  switch (timeframe) {
    case "24h":
      return value.subtract(24, "hour");
    case "30d":
      return value.subtract(30, "day");
    case "7d":
    default:
      return value.subtract(7, "day");
  }
};

const getTimeWindow = (timeframe: FlowRateSummaryTimeframe) => {
  const endDate = dayjs();
  const startDate = subtractTimeframe(endDate, timeframe);

  return {
    end_date: endDate.toISOString(),
    start_date: startDate.toISOString(),
  };
};

const getFlowRateTrends = async (timeframe: FlowRateSummaryTimeframe): Promise<FlowRateTrendsResponse> => {
  const { data } = await axios.get<FlowRateTrendsResponse>(`${OpenAPI.BASE}/ui/dashboard/flowrate_trends`, {
    params: getTimeWindow(timeframe),
  });

  return data;
};

export const useFlowRateTrends = ({
  refetchInterval,
  timeframe,
}: {
  readonly refetchInterval?: number | false;
  readonly timeframe: FlowRateSummaryTimeframe;
}) =>
  useQuery({
    queryFn: () => getFlowRateTrends(timeframe),
    queryKey: ["flowRateTrends", timeframe],
    refetchInterval,
  });