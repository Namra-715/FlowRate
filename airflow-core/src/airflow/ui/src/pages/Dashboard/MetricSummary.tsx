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
import { FiChevronRight, FiRefreshCw } from "react-icons/fi";

type Trend = {
  readonly label: string;
  readonly tone: "positive" | "negative";
};

type SummaryCard = {
  readonly label: string;
  readonly value: string;
  readonly suffix?: string;
  readonly trend?: Trend;
  readonly secondary?: string;
  readonly accent?: "blue" | "purple";
};

const summaryCards: Array<SummaryCard> = [
  {
    label: "TOTAL EST. COST",
    value: "$142",
    suffix: ".38",
    trend: { label: "12% vs prev", tone: "negative" },
  },
  {
    label: "TASKS TRACKED",
    value: "2,841",
    trend: { label: "3% vs prev", tone: "positive" },
  },
  {
    label: "AVG COST/ DAG RUN",
    value: "$0",
    suffix: ".84",
    trend: { label: "8% vs prev", tone: "negative" },
  },
  {
    label: "CPU · MEMORY SPLIT",
    value: "68%",
    suffix: " cpu/",
    secondary: "32% mem",
    accent: "blue",
  },
];

const trendStyles = {
  negative: {
    bg: "red.subtle",
    color: "fg.error",
    prefix: "↑",
  },
  positive: {
    bg: "green.subtle",
    color: "fg.success",
    prefix: "↓",
  },
} as const;

export const MetricSummary = () => (
  <Box>
    <Flex alignItems={{ base: "flex-start", md: "center" }} justifyContent="space-between" mb={5} gap={3}>
      <Box>
        <Text color="fg.muted" fontSize="sm" mb={1}>
          Resource consumption & cost analysis · Apache Airflow plugin
        </Text>
        <HStack color="fg.muted" gap={6} textStyle="sm">
          <Text borderBottomWidth="2px" borderColor="brand.solid" color="fg" fontWeight="semibold" pb={1}>
            Dashboard
          </Text>
          <Text>Trends</Text>
          <Text>Configuration</Text>
        </HStack>
      </Box>

      <HStack alignSelf={{ base: "stretch", md: "center" }}>
        <NativeSelect.Root size="sm" width="150px">
          <NativeSelect.Field defaultValue="7d">
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>

        <Button size="sm" variant="outline">
          <FiRefreshCw />
          Refresh
        </Button>
      </HStack>
    </Flex>

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
            <Text color={card.accent === "blue" ? "blue.fg" : "fg.emphasized"} fontSize="4xl" fontWeight="semibold" lineHeight={1}>
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
              7-day window
            </Badge>
          ) : (
            <Badge
              backgroundColor={trendStyles[card.trend.tone].bg}
              borderRadius="md"
              color={trendStyles[card.trend.tone].color}
              px={2}
              py={1}
            >
              {trendStyles[card.trend.tone].prefix} {card.trend.label}
            </Badge>
          )}
        </Box>
      ))}
    </Grid>

    <Flex justifyContent="flex-end" mt={3}>
      <Button color="fg.muted" size="sm" variant="ghost">
        See More
        <FiChevronRight />
      </Button>
    </Flex>
  </Box>
);