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
import { Box, Button, Flex, Grid, HStack, Input, Text, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ErrorAlert } from "src/components/ErrorAlert";
import { Switch } from "src/components/ui";
import {
  type FlowRateConfiguration,
  useFlowRateConfiguration,
  useUpdateFlowRateConfiguration,
} from "src/queries/useFlowRateConfiguration";

const surfaceStyles = {
  backgroundColor: "#121A37",
  borderColor: "#1E2A52",
  borderRadius: "6px",
  borderWidth: "1px",
} as const;

const infoBannerStyles = {
  backgroundColor: "#213766",
  borderColor: "#36518C",
  borderRadius: "6px",
  borderWidth: "1px",
} as const;

type ConfigRowProps = {
  readonly children: React.ReactNode;
  readonly helper: string;
  readonly label: string;
};

type FlowRateConfigurationDraft = {
  readonly isEnabled: boolean;
  readonly cpuPricePerCoreHour: string;
  readonly memoryPricePerGibHour: string;
  readonly retentionDays: string;
};

const RETENTION_DAYS_MIN = 1;
const RETENTION_DAYS_MAX = 365;
const PRICE_DECIMAL_PATTERN = /^(\d+)?(\.\d*)?$/u;

const ConfigRow = ({ children, helper, label }: ConfigRowProps) => (
  <Grid
    alignItems="start"
    borderTopColor="#1E2A52"
    borderTopWidth="1px"
    columnGap={6}
    py={5}
    templateColumns={{ base: "1fr", md: "1.2fr 1fr" }}
  >
    <Box>
      <Text color="#CBD4F1" fontSize="sm" fontWeight={600} mb={1}>
        {label}
      </Text>
      <Text color="#6F7895" fontSize="sm">
        {helper}
      </Text>
    </Box>
    <Box>{children}</Box>
  </Grid>
);

export const FlowRateConfigurationSection = () => {
  const { t: translate } = useTranslation("dashboard");
  const configurationQuery = useFlowRateConfiguration();
  const updateConfigurationMutation = useUpdateFlowRateConfiguration();

  const defaultConfig: FlowRateConfigurationDraft = {
    isEnabled: true,
    cpuPricePerCoreHour: "0.031611",
    memoryPricePerGibHour: "0.004237",
    retentionDays: "7",
  };
  const [savedConfig, setSavedConfig] = useState(defaultConfig);
  const [draftConfig, setDraftConfig] = useState(defaultConfig);

  useEffect(() => {
    if (!configurationQuery.data) {
      return;
    }

    const nextConfig: FlowRateConfigurationDraft = {
      isEnabled: configurationQuery.data.enabled,
      cpuPricePerCoreHour: configurationQuery.data.cpu_price_per_core_hour.toString(),
      memoryPricePerGibHour: configurationQuery.data.memory_price_per_gib_hour.toString(),
      retentionDays: configurationQuery.data.retention_days.toString(),
    };

    setSavedConfig(nextConfig);
    setDraftConfig(nextConfig);
  }, [configurationQuery.data]);

  const parsedRetentionDays = Number.parseInt(draftConfig.retentionDays, 10);
  const parsedCpuPricePerCoreHour = Number.parseFloat(draftConfig.cpuPricePerCoreHour);
  const parsedMemoryPricePerGibHour = Number.parseFloat(draftConfig.memoryPricePerGibHour);
  const isRetentionValid =
    Number.isInteger(parsedRetentionDays) &&
    parsedRetentionDays >= RETENTION_DAYS_MIN &&
    parsedRetentionDays <= RETENTION_DAYS_MAX;
  const isCpuPriceValid =
    draftConfig.cpuPricePerCoreHour !== "" &&
    Number.isFinite(parsedCpuPricePerCoreHour) &&
    parsedCpuPricePerCoreHour >= 0;
  const isMemoryPriceValid =
    draftConfig.memoryPricePerGibHour !== "" &&
    Number.isFinite(parsedMemoryPricePerGibHour) &&
    parsedMemoryPricePerGibHour >= 0;

  const saveConfiguration = async () => {
    if (!isRetentionValid || !isCpuPriceValid || !isMemoryPriceValid) {
      return;
    }

    const payload: FlowRateConfiguration = {
      enabled: draftConfig.isEnabled,
      cpu_price_per_core_hour: parsedCpuPricePerCoreHour,
      memory_price_per_gib_hour: parsedMemoryPricePerGibHour,
      retention_days: parsedRetentionDays,
    };
    const updatedConfiguration = await updateConfigurationMutation.mutateAsync(payload);
    const nextSavedConfig: FlowRateConfigurationDraft = {
      isEnabled: updatedConfiguration.enabled,
      cpuPricePerCoreHour: updatedConfiguration.cpu_price_per_core_hour.toString(),
      memoryPricePerGibHour: updatedConfiguration.memory_price_per_gib_hour.toString(),
      retentionDays: updatedConfiguration.retention_days.toString(),
    };
    setSavedConfig(nextSavedConfig);
    setDraftConfig(nextSavedConfig);
  };

  const hasChanges =
    draftConfig.isEnabled !== savedConfig.isEnabled ||
    draftConfig.cpuPricePerCoreHour !== savedConfig.cpuPricePerCoreHour ||
    draftConfig.memoryPricePerGibHour !== savedConfig.memoryPricePerGibHour ||
    draftConfig.retentionDays !== savedConfig.retentionDays;

  return (
    <VStack align="stretch" gap={4} mt={4}>
      <Flex align={{ base: "stretch", md: "flex-start" }} direction={{ base: "column", md: "row" }} justify="space-between" gap={4}>
        <Box>
          <Text color="#CBD4F1" fontSize="2xl" fontWeight={700} mb={1}>
            {translate("flowrate.configurationTitle", { defaultValue: "Configuration" })}
          </Text>
          <Text color="#6F7895" fontSize="sm">
            {translate("flowrate.configurationSubtitle", {
              defaultValue: "Plugin behavior and cost-model inputs for the current FlowRate setup.",
            })}
          </Text>
        </Box>

        <HStack align="flex-start" justify={{ base: "flex-start", md: "flex-end" }}>
          <Button
            disabled={configurationQuery.isLoading || updateConfigurationMutation.isPending || !hasChanges}
            onClick={() => setDraftConfig(defaultConfig)}
            size="sm"
            variant="outline"
          >
            {translate("flowrate.resetToDefaults", { defaultValue: "Reset to defaults" })}
          </Button>
          <Button
            backgroundColor="#4F7BFF"
            color="#F7FAFF"
            disabled={
              configurationQuery.isLoading ||
              updateConfigurationMutation.isPending ||
              !hasChanges ||
              !isRetentionValid ||
              !isCpuPriceValid ||
              !isMemoryPriceValid
            }
            loading={updateConfigurationMutation.isPending}
            onClick={() => void saveConfiguration()}
            size="sm"
            _hover={{ backgroundColor: "#6A90FF" }}
          >
            {translate("flowrate.saveChanges", { defaultValue: "Save changes" })}
          </Button>
        </HStack>
      </Flex>

      <ErrorAlert error={configurationQuery.error ?? updateConfigurationMutation.error} />

      <Flex {...infoBannerStyles} align={{ base: "flex-start", md: "center" }} gap={3} px={4} py={3}>
        <Text color="#9DB8FF" fontSize="sm">
          {translate("flowrate.configurationSource", {
            defaultValue:
              "Plugin settings reflect the current FlowRate experience in this workspace, including the pricing used for cost estimates.",
          })}
        </Text>
      </Flex>

      <Box {...surfaceStyles} overflow="hidden">
        <Box px={5} py={4}>
          <Text color="#CBD4F1" fontSize="md" fontWeight={700}>
            {translate("flowrate.pluginSettings", { defaultValue: "Plugin Settings" })}
          </Text>
        </Box>

        <Box px={5}>
          <ConfigRow
            helper={translate("flowrate.enableFlowRateHelp", {
              defaultValue: "Turn FlowRate collection on or off for this workspace experience.",
            })}
            label={translate("flowrate.enableFlowRate", { defaultValue: "Enable FlowRate" })}
          >
            <HStack justify={{ base: "flex-start", md: "flex-end" }}>
              <Text color={draftConfig.isEnabled ? "#5BD475" : "#95A1C4"} fontSize="sm" fontWeight={600}>
                {translate(draftConfig.isEnabled ? "flowrate.enabled" : "flowrate.disabled", {
                  defaultValue: draftConfig.isEnabled ? "Enabled" : "Disabled",
                })}
              </Text>
              <Switch
                checked={draftConfig.isEnabled}
                onCheckedChange={({ checked }) =>
                  setDraftConfig((currentConfig) => ({ ...currentConfig, isEnabled: checked }))
                }
                variant="raised"
              />
            </HStack>
          </ConfigRow>

          <ConfigRow
            helper={translate("flowrate.cpuPricingHelp", {
              defaultValue: "Price applied to one full CPU core for one hour of runtime.",
            })}
            label={translate("flowrate.cpuPricing", { defaultValue: "CPU price per core-hour" })}
          >
            <HStack justify={{ base: "flex-start", md: "flex-end" }}>
              <Input
                backgroundColor="#0F1731"
                borderColor="#2B3A6E"
                color="#E6ECFF"
                disabled={configurationQuery.isLoading || updateConfigurationMutation.isPending}
                maxW="160px"
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (!PRICE_DECIMAL_PATTERN.test(nextValue)) {
                    return;
                  }
                  setDraftConfig((currentConfig) => ({
                    ...currentConfig,
                    cpuPricePerCoreHour: nextValue,
                  }));
                }}
                size="sm"
                textAlign="right"
                type="text"
                value={draftConfig.cpuPricePerCoreHour}
              />
            </HStack>
            {!isCpuPriceValid ? (
              <Text color="#FF7A45" fontSize="12px" mt={2} textAlign={{ base: "left", md: "right" }}>
                {translate("flowrate.priceValidation", {
                  defaultValue: "Enter a non-negative numeric price.",
                })}
              </Text>
            ) : undefined}
          </ConfigRow>

          <ConfigRow
            helper={translate("flowrate.memoryPricingHelp", {
              defaultValue: "Price applied to one GiB of memory for one hour of runtime.",
            })}
            label={translate("flowrate.memoryPricing", { defaultValue: "Memory price per GiB-hour" })}
          >
            <HStack justify={{ base: "flex-start", md: "flex-end" }}>
              <Input
                backgroundColor="#0F1731"
                borderColor="#2B3A6E"
                color="#E6ECFF"
                disabled={configurationQuery.isLoading || updateConfigurationMutation.isPending}
                maxW="160px"
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (!PRICE_DECIMAL_PATTERN.test(nextValue)) {
                    return;
                  }
                  setDraftConfig((currentConfig) => ({
                    ...currentConfig,
                    memoryPricePerGibHour: nextValue,
                  }));
                }}
                size="sm"
                textAlign="right"
                type="text"
                value={draftConfig.memoryPricePerGibHour}
              />
            </HStack>
            {!isMemoryPriceValid ? (
              <Text color="#FF7A45" fontSize="12px" mt={2} textAlign={{ base: "left", md: "right" }}>
                {translate("flowrate.priceValidation", {
                  defaultValue: "Enter a non-negative numeric price.",
                })}
              </Text>
            ) : undefined}
          </ConfigRow>

          <ConfigRow
            helper={translate("flowrate.dataRetentionHelp", {
              defaultValue: "Choose how many days of FlowRate task metrics to keep.",
            })}
            label={translate("flowrate.dataRetention", { defaultValue: "Data retention" })}
          >
            <HStack justify={{ base: "flex-start", md: "flex-end" }}>
              <Input
                backgroundColor="#0F1731"
                borderColor="#2B3A6E"
                color="#E6ECFF"
                disabled={configurationQuery.isLoading || updateConfigurationMutation.isPending}
                maxW="96px"
                onChange={(event) =>
                  setDraftConfig((currentConfig) => ({
                    ...currentConfig,
                    retentionDays: event.target.value.replace(/[^0-9]/gu, ""),
                  }))
                }
                size="sm"
                textAlign="center"
                type="text"
                value={draftConfig.retentionDays}
              />
              <Text color="#95A1C4" fontSize="sm" fontWeight={500}>
                {translate("flowrate.daysLabel", { defaultValue: "days" })}
              </Text>
            </HStack>
            {draftConfig.retentionDays !== "" && !isRetentionValid ? (
              <Text color="#FF7A45" fontSize="12px" mt={2} textAlign={{ base: "left", md: "right" }}>
                {translate("flowrate.retentionValidation", {
                  defaultValue: "Enter a value between 1 and 365 days.",
                })}
              </Text>
            ) : undefined}
          </ConfigRow>

        </Box>
      </Box>
    </VStack>
  );
};
