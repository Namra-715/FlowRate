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
import { Fragment } from "react";

type DagCostRow = {
  readonly avgDuration: string;
  readonly dagId: string;
  readonly estimatedCost: string;
  readonly runs: number;
  readonly status: "running" | "success";
};

type TaskCostRow = {
  readonly avgCostPerRun: string;
  readonly avgDuration: string;
  readonly cpuReq: string;
  readonly dagId: string;
  readonly memoryReq: string;
  readonly operator: string;
  readonly operatorTone: "blue" | "purple";
  readonly progressPercent: number;
  readonly progressTone: "blue" | "orange" | "yellow";
  readonly taskId: string;
};

const topDagRows: Array<DagCostRow> = [
  { avgDuration: "12m 04s", dagId: "etl_customer_data", estimatedCost: "$38.20", runs: 47, status: "success" },
  { avgDuration: "28m 11s", dagId: "dbt_transform_prod", estimatedCost: "$38.20", runs: 31, status: "success" },
  { avgDuration: "3m 42s", dagId: "ml_feature_pipeline", estimatedCost: "$38.20", runs: 168, status: "success" },
  { avgDuration: "7m 18s", dagId: "reporting_hourly", estimatedCost: "$38.20", runs: 56, status: "running" },
  { avgDuration: "12m 04s", dagId: "data_quality_checks", estimatedCost: "$38.20", runs: 22, status: "success" },
  { avgDuration: "18m 55s", dagId: "dbt_transform_prod", estimatedCost: "$38.20", runs: 7, status: "success" },
  { avgDuration: "3m 42s", dagId: "archive_old_records", estimatedCost: "$38.20", runs: 47, status: "success" },
];

const topTaskRows: Array<TaskCostRow> = [
  {
    avgCostPerRun: "$0.38",
    avgDuration: "22m 40s",
    cpuReq: "4.0",
    dagId: "ml_feature_pipeline",
    memoryReq: "8 GB",
    operator: "KubernetesPodOp",
    operatorTone: "purple",
    progressPercent: 100,
    progressTone: "orange",
    taskId: "train_model_step",
  },
  {
    avgCostPerRun: "$0.22",
    avgDuration: "8m 12s",
    cpuReq: "2.0",
    dagId: "etl_customer_data",
    memoryReq: "4 GB",
    operator: "BashOperator",
    operatorTone: "blue",
    progressPercent: 72,
    progressTone: "yellow",
    taskId: "extract_raw_data",
  },
  {
    avgCostPerRun: "$0.14",
    avgDuration: "17m 30s",
    cpuReq: "1.0",
    dagId: "dbt_transform_prod",
    memoryReq: "2 GB",
    operator: "BashOperator",
    operatorTone: "blue",
    progressPercent: 36,
    progressTone: "blue",
    taskId: "dbt_run_full_refresh",
  },
];

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

const renderProgressTrack = (percent: number, tone: keyof typeof toneColor) => (
  <Box backgroundColor="#26345E" borderRadius="full" h="4px" minW="82px" overflow="hidden" w="100%">
    <Box backgroundColor={toneColor[tone]} borderRadius="full" h="100%" width={`${Math.max(0, Math.min(100, percent))}%`} />
  </Box>
);

export const FlowRateTrendsBottomSection = () => (
  <VStack align="stretch" gap={3} mt={4}>
    <Grid gap={3} templateColumns={{ base: "1fr", lg: "1.9fr 1fr" }}>
      <Box {...cardStyles} p={4}>
        <Flex align="center" justify="space-between" mb={3}>
          <Text color="#CBD4F1" fontSize="lg" fontWeight={600}>
            Top DAGs by Estimated Cost
          </Text>

          <NativeSelect.Root size="sm" width="130px">
            <NativeSelect.Field color="#95A1C4" defaultValue="7d">
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

            {topDagRows.map((row, index) => (
              <Fragment key={`${row.dagId}-${index}-dag`}>
                <Text color="#4F88FF" fontSize="14px">
                  {row.dagId}
                </Text>
                <Text {...cellTextStyle}>{row.runs}</Text>
                <Text {...cellTextStyle}>{row.avgDuration}</Text>
                <HStack align="center" spacing={2}>
                  <Badge
                    backgroundColor={statusStyles[row.status].bg}
                    borderRadius="full"
                    color={statusStyles[row.status].color}
                    fontSize="12px"
                    fontWeight={500}
                    px={2}
                    py={0.5}
                  >
                    <HStack gap={1.5}>
                      <Box backgroundColor={statusStyles[row.status].dot} borderRadius="full" h="8px" w="8px" />
                      <Text as="span" fontSize="12px">
                        {row.status}
                      </Text>
                    </HStack>
                  </Badge>
                </HStack>
                <Text {...cellTextStyle}>{row.estimatedCost}</Text>
                <Box alignSelf="center" minW="150px">
                  {renderProgressTrack(100, "orange")}
                </Box>
              </Fragment>
            ))}
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
              background="conic-gradient(#4F88FF 0 68%, #8F68FF 68% 100%)"
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
                  68%
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
                $96.82
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
                $45.56
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
              $0.048 / vCPU-hr
            </Text>
            <Text color="#7081AD" fontSize="16px">
              $0.006 / GB-hr
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
          <NativeSelect.Field color="#95A1C4" defaultValue="all_dags">
            <option value="all_dags">All DAGs</option>
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

          {topTaskRows.map((row, index) => (
            <Fragment key={`${row.taskId}-${index}-task`}>
              <Text color="#4F88FF" fontSize="14px">
                {row.taskId}
              </Text>
              <Text {...cellTextStyle}>{row.dagId}</Text>
              <Badge
                alignSelf="center"
                backgroundColor={operatorStyles[row.operatorTone].bg}
                borderRadius="full"
                color={operatorStyles[row.operatorTone].color}
                fontSize="12px"
                fontWeight={500}
                justifySelf="start"
                px={2.5}
                py={1}
              >
                {row.operator}
              </Badge>
              <Text {...cellTextStyle}>{row.avgDuration}</Text>
              <Text {...cellTextStyle}>{row.cpuReq}</Text>
              <Text {...cellTextStyle}>{row.memoryReq}</Text>
              <Text color="#D7DFF7" fontSize="24px" fontWeight={300} lineHeight={1}>
                {row.avgCostPerRun}
              </Text>
              <Box alignSelf="center" minW="82px">
                {renderProgressTrack(row.progressPercent, row.progressTone)}
              </Box>
            </Fragment>
          ))}
        </Grid>
      </Box>
    </Box>
  </VStack>
);