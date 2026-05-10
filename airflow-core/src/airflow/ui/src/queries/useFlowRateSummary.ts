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

export type FlowRateSummaryTimeframe = "24h" | "7d" | "30d";

export type FlowRateSummaryResponse = {
  readonly average_cost_per_dag_run: number;
  readonly resource_split: {
    readonly cpu_percentage: number;
    readonly memory_percentage: number;
  };
  readonly tasks_tracked: number;
  readonly total_estimated_cost: number;
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

const getTimeWindow = (timeframe: FlowRateSummaryTimeframe, windowOffset = 0) => {
  let endDate = dayjs();

  for (let index = 0; index < windowOffset; index += 1) {
    endDate = subtractTimeframe(endDate, timeframe);
  }

  const startDate = subtractTimeframe(endDate, timeframe);

  return {
    end_date: endDate.toISOString(),
    start_date: startDate.toISOString(),
  };
};

const getFlowRateSummary = async (
  timeframe: FlowRateSummaryTimeframe,
  windowOffset = 0,
): Promise<FlowRateSummaryResponse> => {
  const { data } = await axios.get<FlowRateSummaryResponse>(`${OpenAPI.BASE}/ui/dashboard/flowrate_summary`, {
    params: getTimeWindow(timeframe, windowOffset),
  });

  return data;
};

export const useFlowRateSummary = ({
  refetchInterval,
  timeframe,
  windowOffset = 0,
}: {
  readonly refetchInterval?: number | false;
  readonly timeframe: FlowRateSummaryTimeframe;
  readonly windowOffset?: number;
}) =>
  useQuery({
    queryFn: () => getFlowRateSummary(timeframe, windowOffset),
    queryKey: ["flowRateSummary", timeframe, windowOffset],
    refetchInterval,
  });
