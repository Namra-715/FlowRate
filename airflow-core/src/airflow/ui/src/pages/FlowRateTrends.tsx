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
import { Box, Heading, Text, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

import { FlowRateTrendsBottomSection } from "src/pages/Dashboard/FlowRateTrendsBottomSection";

export const FlowRateTrends = () => {
  const { t: translate } = useTranslation("dashboard");

  return (
    <Box overflow="auto" px={{ base: 2, md: 4 }}>
      <VStack alignItems="stretch" gap={4}>
        <Box>
          <Heading size="2xl">{translate("flowrate.trendsTitle", { defaultValue: "FlowRate Trends" })}</Heading>
          <Text color="fg.muted" fontSize="sm" mt={1}>
            {translate("flowrate.resourceConsumption", {
              defaultValue: "Resource consumption & cost analysis · Apache Airflow plugin",
            })}
          </Text>
        </Box>
        <FlowRateTrendsBottomSection />
      </VStack>
    </Box>
  );
};
