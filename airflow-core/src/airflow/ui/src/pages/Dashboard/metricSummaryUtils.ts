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
import type { FlowRateSummaryResponse } from "src/queries/useFlowRateSummary";

export type Trend = {
  readonly direction: "down" | "up";
  readonly label: string;
  readonly tone: "negative" | "positive";
};

export type SummaryCard = {
  readonly accent?: "blue" | "purple";
  readonly label: string;
  readonly secondary?: string;
  readonly suffix?: string;
  readonly trend?: Trend;
  readonly value: string;
};

export const zeroSummary: FlowRateSummaryResponse = {
  average_cost_per_dag_run: 0,
  resource_split: {
    cpu_percentage: 0,
    memory_percentage: 0,
  },
  tasks_tracked: 0,
  total_estimated_cost: 0,
};

export const trendStyles = {
  negative: {
    bg: "red.subtle",
    color: "fg.error",
  },
  positive: {
    bg: "green.subtle",
    color: "fg.success",
  },
} as const;

export const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

type SummarySource =
  | FlowRateSummaryResponse
  | {
      average_cost_per_dag_run?: unknown;
      resource_split?: {
        cpu_percentage?: unknown;
        memory_percentage?: unknown;
      } | null;
      tasks_tracked?: unknown;
      total_estimated_cost?: unknown;
    }
  | null
  | undefined;

export const normalizeSummary = (source: SummarySource): FlowRateSummaryResponse => {
  const resourceSplit = source?.resource_split ?? {};

  return {
    average_cost_per_dag_run: toFiniteNumber(source?.average_cost_per_dag_run),
    resource_split: {
      cpu_percentage: toFiniteNumber(resourceSplit.cpu_percentage),
      memory_percentage: toFiniteNumber(resourceSplit.memory_percentage),
    },
    tasks_tracked: toFiniteNumber(source?.tasks_tracked),
    total_estimated_cost: toFiniteNumber(source?.total_estimated_cost),
  };
};

export const formatCurrencyParts = (value: number) => {
  const [whole, fraction] = toFiniteNumber(value).toFixed(2).split(".");

  return {
    suffix: `.${fraction}`,
    value: Number(whole).toLocaleString("en-US", {
      currency: "USD",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
      style: "currency",
    }),
  };
};

const formatDelta = (value: number) => {
  const absoluteValue = Math.abs(value);

  return `${absoluteValue >= 10 ? absoluteValue.toFixed(0) : absoluteValue.toFixed(1)}% vs prev`;
};

export const buildTrend = ({
  current,
  increaseIsGood,
  previous,
}: {
  readonly current: number;
  readonly increaseIsGood: boolean;
  readonly previous: number;
}): Trend | undefined => {
  if (previous <= 0) {
    return undefined;
  }

  const delta = ((current - previous) / previous) * 100;

  if (!Number.isFinite(delta)) {
    return undefined;
  }

  return {
    direction: delta >= 0 ? "up" : "down",
    label: formatDelta(delta),
    tone: increaseIsGood ? (delta >= 0 ? "positive" : "negative") : delta <= 0 ? "positive" : "negative",
  };
};
