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
import { Badge, Box, Flex, Grid, HStack, NativeSelect, Text, VStack } from "@chakra-ui/react";
import { Fragment, useMemo, useState } from "react";

import { ErrorAlert } from "src/components/ErrorAlert";
import { useFlowRateTrends } from "src/queries/useFlowRateTrends";
import type { FlowRateSummaryTimeframe } from "src/queries/useFlowRateSummary";
import { useAutoRefresh } from "src/utils";

const toneColor = {
  blue: "#4F88FF",
  orange: "#FF7A45",
  yellow: "#F5BD2E",
} as const;

const statusStyles = {
  running: {
    bg: "#473416",
    color: "#F5BD2E",
    dot: "#F5BD2E",
  },
  success: {
    bg: "#153B2A",
    color: "#5BD475",
    dot: "#5BD475",
  },
} as const;

const operatorStyles = {
  blue: {
    bg: "#1E3A72",
    color: "#6BA9FF",
  },
  purple: {
    bg: "#32255F",
    color: "#A991FF",
  },
} as const;

const headerTextStyle = {
  color: "#6F7895",
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
} as const;

const cellTextStyle = {
  color: "#95A1C4",
  fontSize: "14px",
} as const;

const cardStyles = {
  backgroundColor: "#121A37",
  borderColor: "#1E2A52",
  borderRadius: "6px",
  borderWidth: "1px",
} as const;

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  });

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
};

const renderProgressTrack = (percent: number, tone: keyof typeof toneColor) => (
  <Box backgroundColor="#26345E" borderRadius="full" h="4px" minW="82px" overflow="hidden" w="100%">
    <Box backgroundColor={toneColor[tone]} borderRadius="full" h="100%" width={`${Math.max(0, Math.min(100, percent))}%`} />
  </Box>
);

export const FlowRateTrendsBottomSection = () => {
  const [timeframe, setTimeframe] = useState<FlowRateSummaryTimeframe>("7d");
  const [selectedDagFilter, setSelectedDagFilter] = useState<string>("all_dags");
  const refetchInterval = useAutoRefresh({ checkPendingRuns: true });
  const trendsQuery = useFlowRateTrends({ refetchInterval, timeframe });
  const trends = trendsQuery.data;

  const maxDagCost = useMemo(
    () => Math.max(1, ...(trends?.top_dags.map((row) => row.estimated_cost) ?? [1])),
    [trends?.top_dags],
  );
  const filteredTopTasks = useMemo(
    () =>
      (trends?.top_tasks ?? []).filter((row) =>
        selectedDagFilter === "all_dags" ? true : row.dag_id === selectedDagFilter,
      ),
    [selectedDagFilter, trends?.top_tasks],
  );
  const maxTaskCost = useMemo(
    () => Math.max(1, ...(filteredTopTasks.map((row) => row.avg_cost_per_run) ?? [1])),
    [filteredTopTasks],
  );

  return (
    <VStack align="stretch" gap={3} mt={4}>
      <ErrorAlert error={trendsQuery.error} />

    <Grid gap={3} templateColumns={{ base: "1fr", lg: "1.9fr 1fr" }}>
      <Box {...cardStyles} p={4}>
        <Flex align="center" justify="space-between" mb={3}>
          <Text color="#CBD4F1" fontSize="lg" fontWeight={600}>
            Top DAGs by Estimated Cost
          </Text>

          <NativeSelect.Root size="sm" width="130px">
            <NativeSelect.Field
              color="#95A1C4"
              onChange={(event) => setTimeframe(event.currentTarget.value as FlowRateSummaryTimeframe)}
              value={timeframe}
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Flex>

        <Box overflowX="auto">
          <Grid columnGap={4} gridTemplateColumns="2fr 0.8fr 1.2fr 1.1fr 0.9fr 1.6fr" rowGap={3}>
            <Text {...headerTextStyle}>DAG ID</Text>
            <Text {...headerTextStyle}>RUNS</Text>
            <Text {...headerTextStyle}>AVG DURATION</Text>
            <Text {...headerTextStyle}>STATUS</Text>
            <Text {...headerTextStyle}>EST.COST</Text>
            <Text {...headerTextStyle} textAlign="right">
              &nbsp;
            </Text>

            {(trends?.top_dags ?? []).map((row, index) => (
              <Fragment key={`${row.dag_id}-${index}-dag`}>
                <Text color="#4F88FF" fontSize="14px">
                  {row.dag_id}
                </Text>
                <Text {...cellTextStyle}>{row.runs.toLocaleString("en-US")}</Text>
                <Text {...cellTextStyle}>{formatDuration(row.avg_duration_seconds)}</Text>
                <HStack align="center" spacing={2}>
                  <Badge
                    backgroundColor={statusStyles[row.status === "running" ? "running" : "success"].bg}
                    borderRadius="full"
                    color={statusStyles[row.status === "running" ? "running" : "success"].color}
                    fontSize="12px"
                    fontWeight={500}
                    px={2}
                    py={0.5}
                  >
                    <HStack gap={1.5}>
                      <Box
                        backgroundColor={statusStyles[row.status === "running" ? "running" : "success"].dot}
                        borderRadius="full"
                        h="8px"
                        w="8px"
                      />
                      <Text as="span" fontSize="12px">
                        {row.status}
                      </Text>
                    </HStack>
                  </Badge>
                </HStack>
                <Text {...cellTextStyle}>{formatCurrency(row.estimated_cost)}</Text>
                <Box alignSelf="center" minW="150px">
                  {renderProgressTrack((row.estimated_cost / maxDagCost) * 100, "orange")}
                </Box>
              </Fragment>
            ))}

            {!trendsQuery.isLoading && (trends?.top_dags ?? []).length === 0 ? (
              <Text color="#7081AD" fontSize="13px">
                No DAG metrics found for this window.
              </Text>
            ) : undefined}
          </Grid>
        </Box>
      </Box>

      <VStack align="stretch" gap={3}>
        <Box {...cardStyles} p={4}>
          <Text color="#CBD4F1" fontSize="lg" fontWeight={600} mb={4}>
            Resource Split
          </Text>

          <Flex align="center" justify="center" mb={4}>
            <Box
              alignItems="center"
              background={`conic-gradient(#4F88FF 0 ${trends?.resource_split.cpu_percentage ?? 0}%, #8F68FF ${
                trends?.resource_split.cpu_percentage ?? 0
              }% 100%)`}
              borderRadius="full"
              display="flex"
              h="108px"
              justifyContent="center"
              position="relative"
              w="108px"
            >
              <Box backgroundColor="#121A37" borderRadius="full" h="76px" w="76px" />
              <Box alignItems="center" display="flex" flexDirection="column" left="50%" position="absolute" top="50%" transform="translate(-50%, -50%)">
                <Text color="#CAD4F0" fontSize="26px" fontWeight={500} lineHeight={1}>
                  {(trends?.resource_split.cpu_percentage ?? 0).toFixed(0)}%
                </Text>
                <Text color="#5F6D92" fontSize="11px" fontWeight={500} letterSpacing="0.06em" textTransform="uppercase">
                  CPU
                </Text>
              </Box>
            </Box>
          </Flex>

          <VStack align="stretch" gap={3}>
            <Flex align="center" justify="space-between">
              <HStack gap={2}>
                <Box backgroundColor="#4F88FF" borderRadius="2px" h="10px" w="10px" />
                <Text color="#7081AD" fontSize="15px">
                  CPU (vCPU-hr)
                </Text>
              </HStack>
              <Text color="#B7C1DF" fontSize="30px" fontWeight={300} lineHeight={1}>
                {formatCurrency(trends?.resource_split.cpu_cost ?? 0)}
              </Text>
            </Flex>
            <Flex align="center" justify="space-between">
              <HStack gap={2}>
                <Box backgroundColor="#8F68FF" borderRadius="2px" h="10px" w="10px" />
                <Text color="#7081AD" fontSize="15px">
                  Memory (GB-hr)
                </Text>
              </HStack>
              <Text color="#B7C1DF" fontSize="30px" fontWeight={300} lineHeight={1}>
                {formatCurrency(trends?.resource_split.memory_cost ?? 0)}
              </Text>
            </Flex>
          </VStack>
        </Box>

        <Box {...cardStyles} p={4}>
          <Text color="#5F6D92" fontSize="12px" letterSpacing="0.08em" mb={2} textTransform="uppercase">
            Pricing Basis
          </Text>
          <VStack align="stretch" gap={1}>
            <Text color="#7081AD" fontSize="16px">
              ${Number(trends?.pricing.cpu_price_per_core_hour ?? 0).toFixed(6)} / vCPU-hr
            </Text>
            <Text color="#7081AD" fontSize="16px">
              ${Number(trends?.pricing.memory_price_per_gib_hour ?? 0).toFixed(6)} / GB-hr
            </Text>
          </VStack>
          <Text color="#5F6D92" fontSize="12px" mt={3}>
            GCP n2-standard <Text as="span" color="#4F88FF">configure -&gt;</Text>
          </Text>
        </Box>
      </VStack>
    </Grid>

    <Box {...cardStyles} p={4}>
      <Flex align="center" justify="space-between" mb={3}>
        <Text color="#CBD4F1" fontSize="lg" fontWeight={600}>
          Top Tasks by Estimated Cost
        </Text>
        <NativeSelect.Root size="sm" width="125px">
          <NativeSelect.Field
            color="#95A1C4"
            onChange={(event) => setSelectedDagFilter(event.currentTarget.value)}
            value={selectedDagFilter}
          >
            <option value="all_dags">All DAGs</option>
            {(trends?.top_dags ?? []).map((row) => (
              <option key={row.dag_id} value={row.dag_id}>
                {row.dag_id}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Flex>

      <Box overflowX="auto">
        <Grid columnGap={4} gridTemplateColumns="1.8fr 2fr 1.6fr 1.5fr 0.8fr 1fr 0.9fr 1.3fr" rowGap={3}>
          <Text {...headerTextStyle}>TASK ID</Text>
          <Text {...headerTextStyle}>DAG</Text>
          <Text {...headerTextStyle}>OPERATOR</Text>
          <Text {...headerTextStyle}>AVG DURATION</Text>
          <Text {...headerTextStyle}>CPU REQ</Text>
          <Text {...headerTextStyle}>MEM REQ</Text>
          <Text {...headerTextStyle}>AVG COST/RUN</Text>
          <Text {...headerTextStyle} textAlign="right">
            &nbsp;
          </Text>

          {filteredTopTasks.map((row, index) => (
            <Fragment key={`${row.task_id}-${index}-task`}>
              <Text color="#4F88FF" fontSize="14px">
                {row.task_id}
              </Text>
              <Text {...cellTextStyle}>{row.dag_id}</Text>
              <Badge
                alignSelf="center"
                backgroundColor={operatorStyles[row.operator?.toLowerCase().includes("kubernetes") ? "purple" : "blue"].bg}
                borderRadius="full"
                color={operatorStyles[row.operator?.toLowerCase().includes("kubernetes") ? "purple" : "blue"].color}
                fontSize="12px"
                fontWeight={500}
                justifySelf="start"
                px={2.5}
                py={1}
              >
                {row.operator ?? "Unknown"}
              </Badge>
              <Text {...cellTextStyle}>{formatDuration(row.avg_duration_seconds)}</Text>
              <Text {...cellTextStyle}>{row.avg_cpu_seconds.toFixed(1)}</Text>
              <Text {...cellTextStyle}>{(row.avg_max_rss_mb / 1024).toFixed(1)} GB</Text>
              <Text color="#D7DFF7" fontSize="24px" fontWeight={300} lineHeight={1}>
                {formatCurrency(row.avg_cost_per_run)}
              </Text>
              <Box alignSelf="center" minW="82px">
                {renderProgressTrack(
                  (row.avg_cost_per_run / maxTaskCost) * 100,
                  index === 0 ? "orange" : index === 1 ? "yellow" : "blue",
                )}
              </Box>
            </Fragment>
          ))}

          {!trendsQuery.isLoading && filteredTopTasks.length === 0 ? (
            <Text color="#7081AD" fontSize="13px">
              No task metrics found for this selection.
            </Text>
          ) : undefined}
        </Grid>
      </Box>
    </Box>
    </VStack>
  );
};