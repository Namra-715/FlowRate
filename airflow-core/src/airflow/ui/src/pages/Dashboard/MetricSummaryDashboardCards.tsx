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
import { Badge, Box, Button, Flex, Grid, HStack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiChevronRight } from "react-icons/fi";

import type { FlowRateSummaryTimeframe } from "src/queries/useFlowRateSummary";

import { trendStyles, type SummaryCard } from "./metricSummaryUtils";

type Props = {
  readonly summaryCards: Array<SummaryCard>;
  readonly timeframe: FlowRateSummaryTimeframe;
};

export const MetricSummaryDashboardCards = ({ summaryCards, timeframe }: Props) => {
  const { t: translate } = useTranslation("dashboard");

  return (
    <>
      <Grid
        gap={4}
        templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }}
      >
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
                <Text
                  color={card.accent === "blue" ? "fg.muted" : "fg.subtle"}
                  fontSize="lg"
                  fontWeight="semibold"
                >
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
                {timeframe === "24h"
                  ? "24-hour window"
                  : timeframe === "30d"
                    ? "30-day window"
                    : "7-day window"}
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
  );
};
