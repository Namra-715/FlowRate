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
import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { FlowRateSummaryTimeframe } from "src/queries/useFlowRateSummary";
import type { FlowRateTrendsResponse } from "src/queries/useFlowRateTrends";

import {
  cardStyles,
  cellTextStyle,
  formatCurrency,
  formatDuration,
  headerTextStyle,
  renderProgressTrack,
  statusStyles,
} from "./FlowRateTrendsShared";

type Props = {
  readonly isLoading: boolean;
  readonly onTimeframeChange: (timeframe: FlowRateSummaryTimeframe) => void;
  readonly timeframe: FlowRateSummaryTimeframe;
  readonly trends?: FlowRateTrendsResponse;
};

export const FlowRateTrendsTopDagsAndResources = ({
  isLoading,
  onTimeframeChange,
  timeframe,
  trends,
}: Props) => {
  const { t: translate } = useTranslation("dashboard");
  const maxDagCost = useMemo(
    () => Math.max(1, ...(trends?.top_dags.map((row) => row.estimated_cost) ?? [1])),
    [trends?.top_dags],
  );

  return (
    <Grid gap={3} templateColumns={{ base: "1fr", lg: "1.9fr 1fr" }}>
      <Box {...cardStyles} minW={0} p={4}>
        <Flex align="center" justify="space-between" mb={3}>
          <Text color="#CBD4F1" fontSize="lg" fontWeight={600}>
            {translate("flowRateTrends.topDagsByEstimatedCost")}
          </Text>

          <NativeSelect.Root size="sm" width="130px">
            <NativeSelect.Field
              color="#95A1C4"
              onChange={(event) => onTimeframeChange(event.currentTarget.value as FlowRateSummaryTimeframe)}
              value={timeframe}
            >
              <option value="24h">{translate("flowRateTrends.last24Hours")}</option>
              <option value="7d">{translate("flowRateTrends.last7Days")}</option>
              <option value="30d">{translate("flowRateTrends.last30Days")}</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Flex>

        <Box overflowX="auto">
          <Grid columnGap={4} gridTemplateColumns="2fr 0.8fr 1.2fr 1.1fr 0.9fr 1.6fr" rowGap={3}>
            <Text {...headerTextStyle}>{translate("flowRateTrends.dagId")}</Text>
            <Text {...headerTextStyle}>{translate("flowRateTrends.runs")}</Text>
            <Text {...headerTextStyle}>{translate("flowRateTrends.avgDuration")}</Text>
            <Text {...headerTextStyle}>{translate("flowRateTrends.status")}</Text>
            <Text {...headerTextStyle}>{translate("flowRateTrends.estimatedCost")}</Text>
            <Text {...headerTextStyle} textAlign="right" />

            {(trends?.top_dags ?? []).map((row) => (
              <Fragment key={row.dag_id}>
                <Text color="#4F88FF" fontSize="14px">
                  {row.dag_id}
                </Text>
                <Text {...cellTextStyle}>{row.runs.toLocaleString("en-US")}</Text>
                <Text {...cellTextStyle}>{formatDuration(row.avg_duration_seconds)}</Text>
                <HStack align="center" gap={2}>
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

            {!isLoading && (trends?.top_dags ?? []).length === 0 ? (
              <Text color="#7081AD" fontSize="13px">
                {translate("flowRateTrends.noDagMetrics")}
              </Text>
            ) : undefined}
          </Grid>
        </Box>
      </Box>

      <VStack align="stretch" gap={3} minW={0}>
        <Box {...cardStyles} p={4}>
          <Text color="#CBD4F1" fontSize="lg" fontWeight={600} mb={4}>
            {translate("flowRateTrends.resourceSplit")}
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
              <Box
                alignItems="center"
                display="flex"
                flexDirection="column"
                left="50%"
                position="absolute"
                top="50%"
                transform="translate(-50%, -50%)"
              >
                <Text color="#CAD4F0" fontSize="26px" fontWeight={500} lineHeight={1}>
                  {(trends?.resource_split.cpu_percentage ?? 0).toFixed(0)}%
                </Text>
                <Text
                  color="#5F6D92"
                  fontSize="11px"
                  fontWeight={500}
                  letterSpacing="0.06em"
                  textTransform="uppercase"
                >
                  {translate("flowRateTrends.cpu")}
                </Text>
              </Box>
            </Box>
          </Flex>

          <VStack align="stretch" gap={3}>
            <Flex align="center" justify="space-between">
              <HStack gap={2}>
                <Box backgroundColor="#4F88FF" borderRadius="2px" h="10px" w="10px" />
                <Text color="#7081AD" fontSize="15px">
                  {translate("flowRateTrends.cpuHours")}
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
                  {translate("flowRateTrends.memoryHours")}
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
            {translate("flowRateTrends.pricingBasis")}
          </Text>
          <VStack align="stretch" gap={1}>
            <Text color="#7081AD" fontSize="16px">
              {translate("flowRateTrends.vcpuPrice", {
                value: Number(trends?.pricing.cpu_price_per_core_hour ?? 0).toFixed(6),
              })}
            </Text>
            <Text color="#7081AD" fontSize="16px">
              {translate("flowRateTrends.memoryPrice", {
                value: Number(trends?.pricing.memory_price_per_gib_hour ?? 0).toFixed(6),
              })}
            </Text>
          </VStack>
          <Text color="#5F6D92" fontSize="12px" mt={3}>
            {translate("flowRateTrends.pricingModel")}{" "}
            <Text as="span" color="#4F88FF">
              {translate("flowRateTrends.configure")}
            </Text>
          </Text>
        </Box>
      </VStack>
    </Grid>
  );
};
