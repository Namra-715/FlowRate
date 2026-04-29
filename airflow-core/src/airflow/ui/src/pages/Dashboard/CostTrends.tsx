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

/* eslint-disable i18next/no-literal-string */
import { Box, Flex, Grid, HStack, Spinner, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import dayjs from "dayjs";
import { Fragment } from "react";
import { Line } from "react-chartjs-2";

import { cardStyles, formatCurrency, headerTextStyle, renderProgressTrack } from "./FlowRateTrendsShared";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type DagCostSummary = {
  avg_cost_per_run: number;
  dag_id: string;
  daily_costs: Array<number>;
  runs: number;
  total: number;
};

type CostTrendsData = {
  dag_summaries: Array<DagCostSummary>;
  daily_totals: Array<number>;
  dates: Array<string>;
};

const DAG_COLORS = ["#4F88FF", "#A855F7", "#F97316", "#22C55E", "#EF4444", "#06B6D4", "#EAB308"];

const useCostTrends = (days: number) =>
  useQuery<CostTrendsData>({
    queryFn: async () => {
      const res = await fetch(`/ui/dashboard/cost_trends?days=${days}`);

      if (!res.ok) {
        throw new Error("Failed to fetch cost trends");
      }

      return res.json() as Promise<CostTrendsData>;
    },
    queryKey: ["cost_trends", days],
  });

export const CostTrends = () => {
  const { data, isLoading } = useCostTrends(7);

  if (isLoading) {
    return (
      <Flex align="center" justify="center" py={12}>
        <Spinner color="#4F88FF" size="lg" />
      </Flex>
    );
  }

  if (!data || data.dag_summaries.length === 0) {
    return (
      <Box color="#6F7895" py={8} textAlign="center">
        No cost data available. Run some DAGs with FlowRate metrics enabled to see trends.
      </Box>
    );
  }

  const { dag_summaries: dagSummaries, daily_totals: dailyTotals, dates } = data;
  const topDags = dagSummaries.slice(0, 7);
  const grandTotal = dailyTotals.reduce((acc, cur) => acc + cur, 0);
  const maxAvgCost = Math.max(1, ...topDags.map((dag) => dag.avg_cost_per_run));

  const lineChartData = {
    datasets: [
      {
        borderColor: "#FFFFFF",
        borderWidth: 2.5,
        data: dailyTotals,
        label: "Total",
        pointBackgroundColor: "#FFFFFF",
        pointRadius: 4,
        tension: 0.3,
      },
      ...topDags.map((dag, idx) => ({
        borderColor: DAG_COLORS[idx % DAG_COLORS.length],
        borderDash: [5, 3],
        borderWidth: 1.5,
        data: dag.daily_costs,
        label: dag.dag_id,
        pointRadius: 3,
        tension: 0.3,
      })),
    ],
    labels: dates.map((date) => dayjs(date).format("MMM\u00A0D")),
  };

  return (
    <Box>
      {/* Top row: Summary table + Avg cost per run */}
      <Grid gap={3} mb={3} templateColumns={{ base: "1fr", lg: "1.6fr 1fr" }}>
        {/* 7-Day DAG Cost Summary */}
        <Box {...cardStyles} minW={0} overflow="hidden" p={4}>
          <Text color="#CBD4F1" fontSize="md" fontWeight={600} mb={3}>
            7-Day DAG Cost Summary
          </Text>
          <Box overflowX="auto">
            <Grid columnGap={4} gridTemplateColumns={`2fr repeat(${dates.length}, 1fr) 1fr`} rowGap={2}>
              {/* Headers */}
              <Text {...headerTextStyle}>DAG</Text>
              {dates.map((date) => (
                <Text key={date} {...headerTextStyle} textAlign="right">
                  {dayjs(date).format("ddd").toUpperCase()}
                </Text>
              ))}
              <Text {...headerTextStyle} color="#4F88FF" textAlign="right">
                TOTAL
              </Text>

              {/* DAG rows */}
              {topDags.map((dag) => (
                <Fragment key={dag.dag_id}>
                  <Text color="#4F88FF" fontSize="13px" truncate>
                    {dag.dag_id}
                  </Text>
                  {dag.daily_costs.map((cost, idx) => (
                    <Text
                      color="#95A1C4"
                      fontSize="13px"
                      key={`${dag.dag_id}-${dates[idx]}`}
                      textAlign="right"
                    >
                      {cost > 0 ? `$${cost.toFixed(1)}` : "—"}
                    </Text>
                  ))}
                  <Text color="#4F88FF" fontSize="13px" fontWeight={600} textAlign="right">
                    {formatCurrency(dag.total)}
                  </Text>
                </Fragment>
              ))}

              {/* ALL DAGS row */}
              <Text color="#6F7895" fontSize="13px" fontWeight={600}>
                ALL DAGS
              </Text>
              {dailyTotals.map((total, idx) => (
                <Text
                  color="#6F7895"
                  fontSize="13px"
                  fontWeight={600}
                  key={`total-${dates[idx]}`}
                  textAlign="right"
                >
                  ${total.toFixed(0)}
                </Text>
              ))}
              <Text color="#4F88FF" fontSize="13px" fontWeight={700} textAlign="right">
                {formatCurrency(grandTotal)}
              </Text>
            </Grid>
          </Box>
        </Box>

        {/* Avg Cost per Run */}
        <Box {...cardStyles} minW={0} p={4}>
          <Text color="#CBD4F1" fontSize="md" fontWeight={600} mb={4}>
            Avg Cost per Run
          </Text>
          <Flex direction="column" gap={3}>
            {topDags.map((dag) => (
              <Flex align="center" gap={3} key={dag.dag_id}>
                <Text color="#4F88FF" flex={1} fontSize="13px" minW="0" truncate>
                  {dag.dag_id}
                </Text>
                <Box flex={2}>{renderProgressTrack((dag.avg_cost_per_run / maxAvgCost) * 100, "blue")}</Box>
                <Text color="#CBD4F1" fontSize="13px" fontWeight={600} minW="40px" textAlign="right">
                  {formatCurrency(dag.avg_cost_per_run)}
                </Text>
              </Flex>
            ))}
          </Flex>
        </Box>
      </Grid>

      {/* Daily Estimated Cost line chart */}
      <Box {...cardStyles} p={4}>
        <HStack gap={2} justify="space-between" mb={3} wrap="wrap">
          <Text color="#CBD4F1" fontSize="md" fontWeight={600}>
            Daily Estimated Cost — Last {dates.length} Days
          </Text>
          <HStack gap={4} wrap="wrap">
            {[
              { color: "#FFFFFF", label: "Total" },
              ...topDags.map((dag, idx) => ({
                color: DAG_COLORS[idx % DAG_COLORS.length],
                label: dag.dag_id,
              })),
            ].map(({ color, label }) => (
              <HStack gap={1.5} key={label}>
                <Box backgroundColor={color} borderRadius="full" h="2px" w="20px" />
                <Text color="#6F7895" fontSize="11px">
                  {label}
                </Text>
              </HStack>
            ))}
          </HStack>
        </HStack>
        <Box h="260px">
          <Line
            data={lineChartData}
            options={{
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: "#1E2A52",
                  bodyColor: "#CBD4F1",
                  borderColor: "#2B3A6E",
                  borderWidth: 1,
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: $${(ctx.raw as number).toFixed(2)}`,
                  },
                  titleColor: "#CBD4F1",
                },
              },
              responsive: true,
              scales: {
                x: {
                  grid: { color: "rgba(255,255,255,0.04)" },
                  ticks: { color: "#6F7895", font: { size: 11 } },
                },
                y: {
                  grid: { color: "rgba(255,255,255,0.04)" },
                  ticks: {
                    callback: (val) => `$${val}`,
                    color: "#6F7895",
                    font: { size: 11 },
                  },
                },
              },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};
