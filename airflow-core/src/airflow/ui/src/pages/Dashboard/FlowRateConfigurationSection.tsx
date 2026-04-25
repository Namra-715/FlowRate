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
import { useLocalStorage } from "usehooks-ts";

import { Switch } from "src/components/ui";
import { FLOWRATE_CONFIGURATION_KEY } from "src/constants/localStorage";

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

type FlowRateConfigurationValues = {
  readonly isEnabled: boolean;
  readonly retentionDays: string;
};

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
  const defaultConfig: FlowRateConfigurationValues = {
    isEnabled: true,
    retentionDays: "7",
  };
  const [savedConfig, setSavedConfig] = useLocalStorage<FlowRateConfigurationValues>(
    FLOWRATE_CONFIGURATION_KEY,
    defaultConfig,
  );
  const [draftConfig, setDraftConfig] = useState(defaultConfig);

  useEffect(() => {
    setDraftConfig(savedConfig);
  }, [savedConfig]);

  const hasChanges =
    draftConfig.isEnabled !== savedConfig.isEnabled || draftConfig.retentionDays !== savedConfig.retentionDays;

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
          <Button onClick={() => setDraftConfig(defaultConfig)} size="sm" variant="outline" disabled={!hasChanges}>
            {translate("flowrate.resetToDefaults", { defaultValue: "Reset to defaults" })}
          </Button>
          <Button
            backgroundColor="#4F7BFF"
            color="#F7FAFF"
            disabled={!hasChanges}
            onClick={() => setSavedConfig(draftConfig)}
            size="sm"
            _hover={{ backgroundColor: "#6A90FF" }}
          >
            {translate("flowrate.saveChanges", { defaultValue: "Save changes" })}
          </Button>
        </HStack>
      </Flex>

      <Flex {...infoBannerStyles} align={{ base: "flex-start", md: "center" }} gap={3} px={4} py={3}>
        <Text color="#9DB8FF" fontSize="sm">
          {translate("flowrate.configurationSource", {
            defaultValue:
              "Plugin settings reflect the current FlowRate experience in this workspace. Sensitive Airflow config remains hidden from the UI.",
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
          </ConfigRow>

        </Box>
      </Box>
    </VStack>
  );
};