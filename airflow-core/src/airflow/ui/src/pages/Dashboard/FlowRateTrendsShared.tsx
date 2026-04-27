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
import { Box } from "@chakra-ui/react";

export const toneColor = {
  blue: "#4F88FF",
  orange: "#FF7A45",
  yellow: "#F5BD2E",
} as const;

export const statusStyles = {
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

export const operatorStyles = {
  blue: {
    bg: "#1E3A72",
    color: "#6BA9FF",
  },
  purple: {
    bg: "#32255F",
    color: "#A991FF",
  },
} as const;

export const headerTextStyle = {
  color: "#6F7895",
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
} as const;

export const cellTextStyle = {
  color: "#95A1C4",
  fontSize: "14px",
} as const;

export const cardStyles = {
  backgroundColor: "#121A37",
  borderColor: "#1E2A52",
  borderRadius: "6px",
  borderWidth: "1px",
} as const;

export const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  });

export const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
};

export const renderProgressTrack = (percent: number, tone: keyof typeof toneColor) => (
  <Box backgroundColor="#26345E" borderRadius="full" h="4px" minW="82px" overflow="hidden" w="100%">
    <Box backgroundColor={toneColor[tone]} borderRadius="full" h="100%" width={`${Math.max(0, Math.min(100, percent))}%`} />
  </Box>
);
