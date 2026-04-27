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
import { VStack } from "@chakra-ui/react";
import { useState } from "react";

import { ErrorAlert } from "src/components/ErrorAlert";
import { useFlowRateTrends } from "src/queries/useFlowRateTrends";
import type { FlowRateSummaryTimeframe } from "src/queries/useFlowRateSummary";
import { useAutoRefresh } from "src/utils";
import { FlowRateTrendsTopDagsAndResources } from "./FlowRateTrendsTopDagsAndResources";
import { FlowRateTrendsTopTasksCard } from "./FlowRateTrendsTopTasksCard";

export const FlowRateTrendsBottomSection = () => {
  const [timeframe, setTimeframe] = useState<FlowRateSummaryTimeframe>("7d");
  const refetchInterval = useAutoRefresh({ checkPendingRuns: true });
  const trendsQuery = useFlowRateTrends({ refetchInterval, timeframe });

  return (
    <VStack align="stretch" gap={3} mt={4}>
      <ErrorAlert error={trendsQuery.error} />

      <FlowRateTrendsTopDagsAndResources
        isLoading={trendsQuery.isLoading}
        onTimeframeChange={setTimeframe}
        timeframe={timeframe}
        trends={trendsQuery.data}
      />
      <FlowRateTrendsTopTasksCard isLoading={trendsQuery.isLoading} trends={trendsQuery.data} />
    </VStack>
  );
};