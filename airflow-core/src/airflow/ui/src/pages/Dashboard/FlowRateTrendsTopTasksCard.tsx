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
import { Badge, Box, Flex, Grid, Text } from "@chakra-ui/react";
import { Select as ReactSelect, type SingleValue } from "chakra-react-select";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { FlowRateTrendsResponse } from "src/queries/useFlowRateTrends";

import {
  cardStyles,
  cellTextStyle,
  formatCurrency,
  formatDuration,
  headerTextStyle,
  operatorStyles,
  renderProgressTrack,
} from "./FlowRateTrendsShared";

type Props = {
  readonly isLoading: boolean;
  readonly trends?: FlowRateTrendsResponse;
};

type DagFilterOption = {
  readonly label: string;
  readonly value: string;
};

const ALL_DAGS_VALUE = "all_dags";

const normalizeDagSearchText = (value: string): string =>
  value.toLowerCase().replaceAll(/[\s_-]+/g, " ").trim();

export const FlowRateTrendsTopTasksCard = ({ isLoading, trends }: Props) => {
  const { t: translate } = useTranslation("dashboard");
  const [selectedDagFilter, setSelectedDagFilter] = useState<string>(ALL_DAGS_VALUE);

  const dagFilterOptions = useMemo<Array<DagFilterOption>>(
    () => [
      { label: translate("flowRateTrends.allDags"), value: ALL_DAGS_VALUE },
      ...(trends?.top_dags ?? []).map((row) => ({ label: row.dag_id, value: row.dag_id })),
    ],
    [trends?.top_dags, translate],
  );

  const selectedDagFilterOption =
    dagFilterOptions.find((option) => option.value === selectedDagFilter) ?? dagFilterOptions[0];

  const filteredTopTasks = useMemo(
    () =>
      (trends?.top_tasks ?? []).filter((row) =>
        selectedDagFilter === ALL_DAGS_VALUE ? true : row.dag_id === selectedDagFilter,
      ),
    [selectedDagFilter, trends?.top_tasks],
  );

  const maxTaskCost = useMemo(
    () => Math.max(1, ...filteredTopTasks.map((row) => row.avg_cost_per_run)),
    [filteredTopTasks],
  );

  return (
    <Box {...cardStyles} p={4}>
      <Flex align="center" justify="space-between" mb={3}>
        <Text color="#CBD4F1" fontSize="lg" fontWeight={600}>
          {translate("flowRateTrends.topTasksByEstimatedCost")}
        </Text>
        <Box minW="220px" width="220px">
          <ReactSelect
            chakraStyles={{
              control: (provided) => ({
                ...provided,
                backgroundColor: "#0F1731",
                borderColor: "#2B3A6E",
                minHeight: "32px",
              }),
              dropdownIndicator: (provided) => ({
                ...provided,
                color: "#95A1C4",
              }),
              input: (provided) => ({
                ...provided,
                color: "#95A1C4",
              }),
              menu: (provided) => ({
                ...provided,
                zIndex: 2,
              }),
              option: (provided, state) => ({
                ...provided,
                backgroundColor: state.isFocused ? "#26345E" : "#121A37",
                color: "#95A1C4",
              }),
              placeholder: (provided) => ({
                ...provided,
                color: "#95A1C4",
              }),
              singleValue: (provided) => ({
                ...provided,
                color: "#95A1C4",
              }),
            }}
            filterOption={({ label }, inputValue) =>
              normalizeDagSearchText(label).includes(normalizeDagSearchText(inputValue))
            }
            isSearchable
            menuPlacement="auto"
            noOptionsMessage={() => translate("flowRateTrends.noDagsFound")}
            onChange={(option: SingleValue<DagFilterOption>) => setSelectedDagFilter(option?.value ?? ALL_DAGS_VALUE)}
            openMenuOnFocus
            options={dagFilterOptions}
            placeholder={translate("flowRateTrends.allDags")}
            value={selectedDagFilterOption}
          />
        </Box>
      </Flex>

      <Box overflowX="auto">
        <Grid columnGap={4} gridTemplateColumns="1.8fr 2fr 1.6fr 1.5fr 0.8fr 1fr 0.9fr 1.3fr" rowGap={3}>
          <Text {...headerTextStyle}>{translate("flowRateTrends.taskId")}</Text>
          <Text {...headerTextStyle}>{translate("flowRateTrends.dag")}</Text>
          <Text {...headerTextStyle}>{translate("flowRateTrends.operator")}</Text>
          <Text {...headerTextStyle}>{translate("flowRateTrends.avgDuration")}</Text>
          <Text {...headerTextStyle}>{translate("flowRateTrends.cpuReq")}</Text>
          <Text {...headerTextStyle}>{translate("flowRateTrends.memoryReq")}</Text>
          <Text {...headerTextStyle}>{translate("flowRateTrends.avgCostPerRun")}</Text>
          <Text {...headerTextStyle} textAlign="right" />

          {filteredTopTasks.map((row, index) => (
            <Fragment key={`${row.dag_id}-${row.task_id}`}>
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
                {row.operator ?? translate("flowRateTrends.unknown")}
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

          {!isLoading && filteredTopTasks.length === 0 ? (
            <Text color="#7081AD" fontSize="13px">
              {translate("flowRateTrends.noTaskMetrics")}
            </Text>
          ) : undefined}
        </Grid>
      </Box>
    </Box>
  );
};
