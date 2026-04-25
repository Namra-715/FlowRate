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
import { Badge, Box, Button, Flex, Grid, HStack, NativeSelect, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiChevronRight, FiRefreshCw } from "react-icons/fi";

import { ErrorAlert } from "src/components/ErrorAlert";
import {
  useFlowRateSummary,
  type FlowRateSummaryResponse,
  type FlowRateSummaryTimeframe,
} from "src/queries/useFlowRateSummary";
import { useAutoRefresh } from "src/utils";
import { buildTrend, formatCurrencyParts, toFiniteNumber, trendStyles, type SummaryCard, zeroSummary } from "./metricSummaryUtils";

export type FlowRateTab = "configuration" | "dashboard" | "trends";

type MetricSummaryProps = {
  readonly activeTab: FlowRateTab;
  readonly onTabChange: (tab: FlowRateTab) => void;
};

export const MetricSummary = ({ activeTab, onTabChange }: MetricSummaryProps) => {
  const { t: translate } = useTranslation("dashboard");
  const [timeframe, setTimeframe] = useState<FlowRateSummaryTimeframe>("7d");
  const refetchInterval = useAutoRefresh({ checkPendingRuns: true });

  const currentSummaryQuery = useFlowRateSummary({ refetchInterval, timeframe });
  const previousSummaryQuery = useFlowRateSummary({ refetchInterval, timeframe, windowOffset: 1 });

  const currentSummaryRaw = currentSummaryQuery.data ?? zeroSummary;
  const previousSummaryRaw = previousSummaryQuery.data ?? zeroSummary;

  const currentSummary: FlowRateSummaryResponse = {
    average_cost_per_dag_run: toFiniteNumber(currentSummaryRaw.average_cost_per_dag_run),
    resource_split: {
      cpu_percentage: toFiniteNumber(currentSummaryRaw.resource_split.cpu_percentage),
      memory_percentage: toFiniteNumber(currentSummaryRaw.resource_split.memory_percentage),
    },
    tasks_tracked: toFiniteNumber(currentSummaryRaw.tasks_tracked),
    total_estimated_cost: toFiniteNumber(currentSummaryRaw.total_estimated_cost),
  };

  const previousSummary: FlowRateSummaryResponse = {
    average_cost_per_dag_run: toFiniteNumber(previousSummaryRaw.average_cost_per_dag_run),
    resource_split: {
      cpu_percentage: toFiniteNumber(previousSummaryRaw.resource_split.cpu_percentage),
      memory_percentage: toFiniteNumber(previousSummaryRaw.resource_split.memory_percentage),
    },
    tasks_tracked: toFiniteNumber(previousSummaryRaw.tasks_tracked),
    total_estimated_cost: toFiniteNumber(previousSummaryRaw.total_estimated_cost),
  };

  const totalEstimatedCost = formatCurrencyParts(currentSummary.total_estimated_cost);
  const averageCostPerDagRun = formatCurrencyParts(currentSummary.average_cost_per_dag_run);

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
      secondary: `${currentSummary.resource_split.memory_percentage.toFixed(0)}% mem`,
      suffix: " cpu/",
      value: `${currentSummary.resource_split.cpu_percentage.toFixed(0)}%`,
    },
  ];

  const isRefreshing = currentSummaryQuery.isFetching || previousSummaryQuery.isFetching;
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
          <HStack borderBottomColor="border.subtle" borderBottomWidth={1} gap={4} textStyle="sm">
            {flowRateTabs.map((tab) => (
              <Box
                _after={{
                  backgroundColor: activeTab === tab.key ? "border.info" : "transparent",
                  borderRadius: "full",
                  bottom: 0,
                  content: '""',
                  height: "2px",
                  left: 0,
                  position: "absolute",
                  right: 0,
                }}
                _focusVisible={{
                  outline: "2px solid",
                  outlineColor: "border.info",
                  outlineOffset: "2px",
                }}
                _hover={{
                  color: "fg",
                }}
                aria-selected={activeTab === tab.key}
                as="button"
                borderRadius="sm"
                color={activeTab === tab.key ? "fg" : "fg.muted"}
                fontWeight={activeTab === tab.key ? "semibold" : "normal"}
                key={tab.key}
                mb="-1px"
                onClick={() => onTabChange(tab.key)}
                pb={2}
                position="relative"
                px={0}
                transition="color 0.2s ease"
              >
                {tab.label}
              </Box>
            ))}
          </HStack>
        </Box>

        {activeTab === "dashboard" ? (
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
      </Flex>

      {activeTab === "dashboard" ? <ErrorAlert error={currentSummaryQuery.error ?? previousSummaryQuery.error} /> : undefined}

      {activeTab === "dashboard" ? (
        <>
          <Grid gap={4} templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }}>
            {summaryCards.map((card) => (
              <Box
                backgroundColor="bg.muted"
                borderColor="border.subtle"
                borderRadius="lg"
                borderWidth="1px"
                key={card.label}
                minH="112px"
                p={4}
              >
                <Text color="fg.muted" fontSize="xs" letterSpacing="0.06em" mb={3}>
                  {card.label}
                </Text>

                <HStack alignItems="baseline" gap={1} mb={3}>
                  <Text
                    color={card.accent === "blue" ? "blue.fg" : "fg.emphasized"}
                    fontSize="4xl"
                    fontWeight="semibold"
                    lineHeight={1}
                  >
                    {card.value}
                  </Text>

                  {card.suffix === undefined ? undefined : (
                    <Text color={card.accent === "blue" ? "fg.muted" : "fg.subtle"} fontSize="lg" fontWeight="semibold">
                      {card.suffix}
                    </Text>
                  )}

                  {card.secondary === undefined ? undefined : (
                    <Text color="purple.fg" fontSize="4xl" fontWeight="semibold" lineHeight={1}>
                      {card.secondary}
                    </Text>
                  )}
                </HStack>

                {card.trend === undefined ? (
                  <Badge borderRadius="md" colorPalette="gray" px={2} py={1}>
                    {timeframe === "24h" ? "24-hour window" : timeframe === "30d" ? "30-day window" : "7-day window"}
                  </Badge>
                ) : (
                  <Badge
                    backgroundColor={trendStyles[card.trend.tone].bg}
                    borderRadius="md"
                    color={trendStyles[card.trend.tone].color}
                    px={2}
                    py={1}
                  >
                    {card.trend.direction === "up" ? "↑" : "↓"} {card.trend.label}
                  </Badge>
                )}
              </Box>
            ))}
          </Grid>

          <Flex justifyContent="flex-end" mt={3}>
            <Button color="fg.muted" size="sm" variant="ghost">
              {translate("flowrate.seeMore", { defaultValue: "See More" })}
              <FiChevronRight />
            </Button>
          </Flex>
        </>
      ) : undefined}
    </Box>
  );
};