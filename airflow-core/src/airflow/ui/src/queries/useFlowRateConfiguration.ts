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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { OpenAPI } from "openapi/requests/core/OpenAPI";

export type FlowRateConfiguration = {
  readonly enabled: boolean;
  readonly retention_days: number;
};

const getFlowRateConfiguration = async (): Promise<FlowRateConfiguration> => {
  const { data } = await axios.get<FlowRateConfiguration>(`${OpenAPI.BASE}/ui/dashboard/flowrate_configuration`);

  return data;
};

const updateFlowRateConfiguration = async (
  configuration: FlowRateConfiguration,
): Promise<FlowRateConfiguration> => {
  const { data } = await axios.put<FlowRateConfiguration>(
    `${OpenAPI.BASE}/ui/dashboard/flowrate_configuration`,
    configuration,
  );

  return data;
};

export const useFlowRateConfiguration = () =>
  useQuery({
    queryFn: getFlowRateConfiguration,
    queryKey: ["flowRateConfiguration"],
  });

export const useUpdateFlowRateConfiguration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateFlowRateConfiguration,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flowRateConfiguration"] }),
        queryClient.invalidateQueries({ queryKey: ["flowRateSummary"] }),
        queryClient.invalidateQueries({ queryKey: ["flowRateTrends"] }),
      ]);
    },
  });
};