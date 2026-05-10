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
import { Box, Button, Flex, HStack, NativeSelect, Text, VStack } from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "react-icons/fi";

import { ErrorAlert } from "src/components/ErrorAlert";
import {
  type FlowRateSummaryResponse,
  type FlowRateSummaryTimeframe,
  useFlowRateSummary,
} from "src/queries/useFlowRateSummary";
import { useAutoRefresh } from "src/utils";

import { MetricSummaryDashboardCards } from "./MetricSummaryDashboardCards";
import {
  buildTrend,
  formatCurrencyParts,
  toFiniteNumber,
  type SummaryCard,
  zeroSummary,
} from "./metricSummaryUtils";

export const MetricSummary = () => {
  const { t: translate } = useTranslation("dashboard");
  const queryClient = useQueryClient();
  const [timeframe, setTimeframe] = useState<FlowRateSummaryTimeframe>("7d");
  const refetchInterval = useAutoRefresh({ checkPendingRuns: true });

  const currentSummaryQuery = useFlowRateSummary({ refetchInterval, timeframe });
  const previousSummaryQuery = useFlowRateSummary({ refetchInterval, timeframe, windowOffset: 1 });

  const currentSummaryRaw = (currentSummaryQuery.data ?? zeroSummary) as
    | ({
        resource_split?: Partial<FlowRateSummaryResponse["resource_split"]> | null;
      } & Partial<FlowRateSummaryResponse>)
    | undefined;
  const previousSummaryRaw = (previousSummaryQuery.data ?? zeroSummary) as
    | ({
        resource_split?: Partial<FlowRateSummaryResponse["resource_split"]> | null;
      } & Partial<FlowRateSummaryResponse>)
    | undefined;

  const currentSummary: FlowRateSummaryResponse = {
    average_cost_per_dag_run: toFiniteNumber(currentSummaryRaw?.average_cost_per_dag_run),
    resource_split: {
      cpu_percentage: toFiniteNumber(currentSummaryRaw?.resource_split?.cpu_percentage),
      memory_percentage: toFiniteNumber(currentSummaryRaw?.resource_split?.memory_percentage),
    },
    tasks_tracked: toFiniteNumber(currentSummaryRaw?.tasks_tracked),
    total_estimated_cost: toFiniteNumber(currentSummaryRaw?.total_estimated_cost),
  };
  const previousSummary: FlowRateSummaryResponse = {
    average_cost_per_dag_run: toFiniteNumber(previousSummaryRaw?.average_cost_per_dag_run),
    resource_split: {
      cpu_percentage: toFiniteNumber(previousSummaryRaw?.resource_split?.cpu_percentage),
      memory_percentage: toFiniteNumber(previousSummaryRaw?.resource_split?.memory_percentage),
    },
    tasks_tracked: toFiniteNumber(previousSummaryRaw?.tasks_tracked),
    total_estimated_cost: toFiniteNumber(previousSummaryRaw?.total_estimated_cost),
  };

  const totalEstimatedCost = formatCurrencyParts(currentSummary.total_estimated_cost);
  const averageCostPerDagRun = formatCurrencyParts(currentSummary.average_cost_per_dag_run);
  const cpuPercentageDisplay = Math.round(currentSummary.resource_split.cpu_percentage);
  const memoryPercentageDisplay = 100 - cpuPercentageDisplay;

  const summaryCards: Array<SummaryCard> = [
    {
      label: "TOTAL EST. COST",
      suffix: totalEstimatedCost.suffix,
      trend: buildTrend({
        current: currentSummary.total_estimated_cost,
        increaseIsGood: false,
        previous: previousSummary.total_estimated_cost,
      }),
      value: totalEstimatedCost.value,
    },
    {
      label: "TASKS TRACKED",
      trend: buildTrend({
        current: currentSummary.tasks_tracked,
        increaseIsGood: true,
        previous: previousSummary.tasks_tracked,
      }),
      value: currentSummary.tasks_tracked.toLocaleString("en-US"),
    },
    {
      label: "AVG COST/ DAG RUN",
      suffix: averageCostPerDagRun.suffix,
      trend: buildTrend({
        current: currentSummary.average_cost_per_dag_run,
        increaseIsGood: false,
        previous: previousSummary.average_cost_per_dag_run,
      }),
      value: averageCostPerDagRun.value,
    },
    {
      accent: "blue",
      label: "CPU · MEMORY SPLIT",
      secondary: `${memoryPercentageDisplay}% mem`,
      suffix: " cpu/",
      value: `${cpuPercentageDisplay}%`,
    },
  ];

  const isRefreshing = currentSummaryQuery.isFetching || previousSummaryQuery.isFetching;
  const isRefreshingTrends = trendsQuery.isFetching;
  const flowRateTabs: Array<{ key: FlowRateTab; label: string }> = [
    { key: "dashboard", label: "Dashboard" },
    { key: "trends", label: "Trends" },
    { key: "configuration", label: "Configuration" },
  ];

  return (
    <Box>
      <Flex alignItems={{ base: "flex-start", md: "center" }} gap={3} justifyContent="space-between" mb={5}>
        <Box>
          <Text color="fg.muted" fontSize="sm" mb={1}>
            {translate("flowrate.resourceConsumption", {
              defaultValue: "Resource consumption & cost analysis · Apache Airflow plugin",
            })}
          </Text>
        </Box>

        <HStack alignSelf={{ base: "stretch", md: "center" }}>
          <NativeSelect.Root size="sm" width="150px">
            <NativeSelect.Field
              onChange={(event) => setTimeframe(event.currentTarget.value as FlowRateSummaryTimeframe)}
              value={timeframe}
            >
              <option value="24h">{translate("flowrate.last24Hours", { defaultValue: "Last 24 hours" })}</option>
              <option value="7d">{translate("flowrate.last7Days", { defaultValue: "Last 7 days" })}</option>
              <option value="30d">{translate("flowrate.last30Days", { defaultValue: "Last 30 days" })}</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>

            <Button
              loading={isRefreshing}
              onClick={() => {
                void currentSummaryQuery.refetch();
                void previousSummaryQuery.refetch();
              }}
              size="sm"
              variant="outline"
            >
              <FiRefreshCw />
              {translate("flowrate.refresh", { defaultValue: "Refresh" })}
            </Button>
          </HStack>
        ) : undefined}

        {activeTab === "trends" ? (
          <HStack alignSelf={{ base: "stretch", md: "center" }}>
            <NativeSelect.Root size="sm" width="150px">
              <NativeSelect.Field
                onChange={(event) => setTrendsTimeframe(event.currentTarget.value as FlowRateSummaryTimeframe)}
                value={trendsTimeframe}
              >
                <option value="24h">
                  {translate("flowrate.last24Hours", { defaultValue: "Last 24 hours" })}
                </option>
                <option value="7d">{translate("flowrate.last7Days", { defaultValue: "Last 7 days" })}</option>
                <option value="30d">
                  {translate("flowrate.last30Days", { defaultValue: "Last 30 days" })}
                </option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>

            <Button
              loading={isRefreshingTrends}
              onClick={() => {
                void trendsQuery.refetch();
                void queryClient.invalidateQueries({ queryKey: ["cost_trends", 7] });
              }}
              size="sm"
              variant="outline"
            >
              <FiRefreshCw />
              {translate("flowrate.refresh", { defaultValue: "Refresh" })}
            </Button>
          </HStack>
        ) : undefined}
      </Flex>

      <ErrorAlert error={currentSummaryQuery.error ?? previousSummaryQuery.error} />

      <MetricSummaryDashboardCards summaryCards={summaryCards} timeframe={timeframe} />
    </Box>
  );
};
