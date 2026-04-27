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
import { Box, Button, Flex, Grid, HStack, Input, NativeSelect, Text, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TbAlertTriangle } from "react-icons/tb";

import { ErrorAlert } from "src/components/ErrorAlert";
import { Switch } from "src/components/ui";
import {
  type FlowRateConfiguration,
  useFlowRateConfiguration,
  useUpdateFlowRateConfiguration,
} from "src/queries/useFlowRateConfiguration";

type CloudProfile = {
  readonly cpuPrice: string;
  readonly label: string;
  readonly memoryPrice: string;
  readonly value: string;
};

const CLOUD_PROFILES: Array<CloudProfile> = [
  { value: "custom", label: "Custom", cpuPrice: "", memoryPrice: "" },
  { value: "gcp-n2-standard", label: "GCP\u2014n2-standard", cpuPrice: "0.048", memoryPrice: "0.006" },
  { value: "gcp-e2-standard", label: "GCP\u2014e2-standard", cpuPrice: "0.034", memoryPrice: "0.0046" },
  { value: "aws-m5-large", label: "AWS\u2014m5.large", cpuPrice: "0.048", memoryPrice: "0.006" },
  { value: "aws-c5-large", label: "AWS\u2014c5.large", cpuPrice: "0.054", memoryPrice: "0.0054" },
  { value: "azure-d2s-v3", label: "Azure\u2014D2s v3", cpuPrice: "0.048", memoryPrice: "0.006" },
];

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
  readonly cloudProfile: string;
  readonly cpuPricePerCoreHour: string;
  readonly cpuRequestFallback: string;
  readonly isEnabled: boolean;
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
    cloudProfile: "gcp-n2-standard",
    cpuPricePerCoreHour: "0.048",
    cpuRequestFallback: "1.0",
    isEnabled: true,
    memoryPricePerGibHour: "0.006",
    retentionDays: "7",
  };
  const [savedConfig, setSavedConfig] = useState(defaultConfig);
  const [draftConfig, setDraftConfig] = useState(defaultConfig);

  useEffect(() => {
    if (!configurationQuery.data) {
      return;
    }

    const cpu = (configurationQuery.data.cpu_price_per_core_hour ?? "").toString();
    const mem = (configurationQuery.data.memory_price_per_gib_hour ?? "").toString();
    const matchedProfile =
      CLOUD_PROFILES.find((p) => p.cpuPrice === cpu && p.memoryPrice === mem && p.value !== "custom")?.value ??
      "custom";
    const nextConfig: FlowRateConfigurationDraft = {
      cloudProfile: matchedProfile,
      cpuPricePerCoreHour: cpu,
      cpuRequestFallback: "1.0",
      isEnabled: configurationQuery.data.enabled ?? false,
      memoryPricePerGibHour: mem,
      retentionDays: (configurationQuery.data.retention_days ?? "").toString(),
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

      {/* Plugin Settings */}
      <Box {...surfaceStyles} overflow="hidden">
        <Box px={5} py={4}>
          <Text color="#CBD4F1" fontSize="md" fontWeight={700}>
            {translate("flowrate.pluginSettings", { defaultValue: "Plugin Settings" })}
          </Text>
        </Box>

        <Box px={5}>
          <ConfigRow
            helper={translate("flowrate.enableFlowRateHelp", {
              defaultValue: "When disabled, no metrics are collected. DAG execution is unaffected",
            })}
            label={translate("flowrate.enableFlowRate", { defaultValue: "Enable FlowRate" })}
          >
            <HStack>
              <Switch
                checked={draftConfig.isEnabled}
                onCheckedChange={({ checked }) =>
                  setDraftConfig((currentConfig) => ({ ...currentConfig, isEnabled: checked }))
                }
                variant="raised"
              />
              <Text color={draftConfig.isEnabled ? "#5BD475" : "#95A1C4"} fontSize="sm" fontWeight={600}>
                {draftConfig.isEnabled
                  ? translate("flowrate.enabled", { defaultValue: "Enabled" })
                  : translate("flowrate.disabled", { defaultValue: "Disabled" })}
              </Text>
            </HStack>
          </ConfigRow>

          <ConfigRow
            helper={translate("flowrate.dataRetentionHelp", {
              defaultValue: "How long task metric records are kept before automatic cleanup.",
            })}
            label={translate("flowrate.dataRetention", { defaultValue: "Data retention" })}
          >
            <HStack>
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
              <Text color="#FF7A45" fontSize="12px" mt={2}>
                {translate("flowrate.retentionValidation", {
                  defaultValue: "Enter a value between 1 and 365 days.",
                })}
              </Text>
            ) : undefined}
          </ConfigRow>
        </Box>
      </Box>

      {/* Pricing Parameters */}
      <Box {...surfaceStyles} overflow="hidden">
        <Box px={5} py={4}>
          <Text color="#CBD4F1" fontSize="md" fontWeight={700}>
            {translate("flowrate.pricingParameters", { defaultValue: "Pricing Parameters" })}
          </Text>
        </Box>

        <Box px={5} pb={2}>
          <HStack
            backgroundColor="#2A1F0A"
            borderColor="#6B4C0A"
            borderRadius="6px"
            borderWidth="1px"
            gap={2}
            mb={4}
            px={4}
            py={3}
          >
            <Box color="#E8A838" flexShrink={0}>
              <TbAlertTriangle size={16} />
            </Box>
            <Text color="#E8A838" fontSize="sm">
              {translate("flowrate.pricingDisclaimer", {
                defaultValue:
                  "These are request-based estimates allocated resources \u00d7 runtime, not actual billing.",
              })}
            </Text>
          </HStack>

          <ConfigRow
            helper={translate("flowrate.cloudProfileHelp", {
              defaultValue: "Pre-fills CPU and memory prices. You can override below",
            })}
            label={translate("flowrate.cloudProfile", { defaultValue: "Cloud profile" })}
          >
            <NativeSelect.Root
              backgroundColor="#0F1731"
              borderColor="#2B3A6E"
              color="#E6ECFF"
              disabled={configurationQuery.isLoading || updateConfigurationMutation.isPending}
              maxW="220px"
              size="sm"
            >
              <NativeSelect.Field
                onChange={(event) => {
                  const profile = CLOUD_PROFILES.find((p) => p.value === event.currentTarget.value);
                  if (!profile || profile.value === "custom") {
                    setDraftConfig((c) => ({ ...c, cloudProfile: "custom" }));
                  } else {
                    setDraftConfig((c) => ({
                      ...c,
                      cloudProfile: profile.value,
                      cpuPricePerCoreHour: profile.cpuPrice,
                      memoryPricePerGibHour: profile.memoryPrice,
                    }));
                  }
                }}
                value={draftConfig.cloudProfile}
              >
                {CLOUD_PROFILES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </ConfigRow>

          <ConfigRow
            helper={translate("flowrate.cpuPricingHelp", {
              defaultValue: "duration \u00d7 cpu_req \u00d7 cpu_price",
            })}
            label={translate("flowrate.cpuPricing", { defaultValue: "CPU price" })}
          >
            <HStack>
              <HStack
                backgroundColor="#0F1731"
                borderColor={isCpuPriceValid ? "#2B3A6E" : "#FF7A45"}
                borderRadius="md"
                borderWidth="1px"
                maxW="200px"
                overflow="hidden"
                px={2}
              >
                <Text color="#6F7895" fontSize="sm" flexShrink={0}>
                  $
                </Text>
                <Input
                  backgroundColor="transparent"
                  border="none"
                  color="#E6ECFF"
                  disabled={configurationQuery.isLoading || updateConfigurationMutation.isPending}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (!PRICE_DECIMAL_PATTERN.test(nextValue)) {
                      return;
                    }
                    setDraftConfig((c) => ({ ...c, cloudProfile: "custom", cpuPricePerCoreHour: nextValue }));
                  }}
                  p={0}
                  size="sm"
                  textAlign="right"
                  type="text"
                  value={draftConfig.cpuPricePerCoreHour}
                />
                <Text color="#6F7895" fontSize="sm" flexShrink={0} whiteSpace="nowrap">
                  /vCPU-hr
                </Text>
              </HStack>
            </HStack>
            {!isCpuPriceValid ? (
              <Text color="#FF7A45" fontSize="12px" mt={1}>
                {translate("flowrate.priceValidation", { defaultValue: "Enter a non-negative numeric price." })}
              </Text>
            ) : undefined}
          </ConfigRow>

          <ConfigRow
            helper={translate("flowrate.memoryPricingHelp", {
              defaultValue: "duration \u00d7 mem_req_gb \u00d7 mem_price",
            })}
            label={translate("flowrate.memoryPricing", { defaultValue: "Memory price" })}
          >
            <HStack>
              <HStack
                backgroundColor="#0F1731"
                borderColor={isMemoryPriceValid ? "#2B3A6E" : "#FF7A45"}
                borderRadius="md"
                borderWidth="1px"
                maxW="200px"
                overflow="hidden"
                px={2}
              >
                <Text color="#6F7895" fontSize="sm" flexShrink={0}>
                  $
                </Text>
                <Input
                  backgroundColor="transparent"
                  border="none"
                  color="#E6ECFF"
                  disabled={configurationQuery.isLoading || updateConfigurationMutation.isPending}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (!PRICE_DECIMAL_PATTERN.test(nextValue)) {
                      return;
                    }
                    setDraftConfig((c) => ({ ...c, cloudProfile: "custom", memoryPricePerGibHour: nextValue }));
                  }}
                  p={0}
                  size="sm"
                  textAlign="right"
                  type="text"
                  value={draftConfig.memoryPricePerGibHour}
                />
                <Text color="#6F7895" fontSize="sm" flexShrink={0} whiteSpace="nowrap">
                  / GB-hr
                </Text>
              </HStack>
            </HStack>
            {!isMemoryPriceValid ? (
              <Text color="#FF7A45" fontSize="12px" mt={1}>
                {translate("flowrate.priceValidation", { defaultValue: "Enter a non-negative numeric price." })}
              </Text>
            ) : undefined}
          </ConfigRow>

          <ConfigRow
            helper={translate("flowrate.cpuFallbackHelp", {
              defaultValue: "duration \u00d7 mem_req_gb \u00d7 mem_price",
            })}
            label={translate("flowrate.cpuFallback", { defaultValue: "Default CPU request fallback" })}
          >
            <HStack>
              <HStack
                backgroundColor="#0F1731"
                borderColor="#2B3A6E"
                borderRadius="md"
                borderWidth="1px"
                maxW="140px"
                overflow="hidden"
                px={2}
              >
                <Input
                  backgroundColor="transparent"
                  border="none"
                  color="#E6ECFF"
                  disabled={configurationQuery.isLoading || updateConfigurationMutation.isPending}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (!PRICE_DECIMAL_PATTERN.test(nextValue)) {
                      return;
                    }
                    setDraftConfig((c) => ({ ...c, cpuRequestFallback: nextValue }));
                  }}
                  p={0}
                  size="sm"
                  textAlign="right"
                  type="text"
                  value={draftConfig.cpuRequestFallback}
                />
                <Text color="#6F7895" fontSize="sm" flexShrink={0}>
                  VCPU
                </Text>
              </HStack>
            </HStack>
          </ConfigRow>
        </Box>
      </Box>
    </VStack>
  );
};
