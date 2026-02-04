/**
 * ============================================================================
 * AUTOMATIC SOS TRIGGER HELPER
 * ============================================================================
 *
 * Purpose:
 * Centralized function to trigger SOS from automated features (Voice, ML Crash).
 * Integrates with existing SOSContext to maintain consistency.
 *
 * This ensures:
 * - Single point of entry for automatic SOS triggers
 * - Proper logging with trigger source
 * - No code duplication between voice and crash detection
 */

import * as Location from "expo-location";
import apiService from "./api";
import type { SOSResponse } from "../types";

type TriggerSource = "VOICE" | "CRASH_ML" | "MANUAL";

interface TriggerSOSResult {
  success: boolean;
  sosId?: number;
  sos?: SOSResponse;
  message: string;
}

/**
 * Trigger SOS from automatic detection systems
 * Gets current location and calls the API to create SOS alert
 *
 * @param source - Where the SOS was triggered from (VOICE, CRASH_ML, or MANUAL)
 * @returns Promise with success status and SOS ID if successful
 */
export async function triggerAutomaticSOS(
  source: TriggerSource
): Promise<TriggerSOSResult> {
  console.log(`🚨 [AutoSOS] Triggering SOS from source: ${source}`);

  try {
    // Request location permission if needed
    const { status: locationStatus } =
      await Location.getForegroundPermissionsAsync();

    if (locationStatus !== "granted") {
      const { status: requestStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (requestStatus !== "granted") {
        throw new Error(
          "Location permission required for automatic SOS trigger"
        );
      }
    }

    // Get current location
    console.log(`📍 [AutoSOS] Getting current location...`);
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const { latitude, longitude } = location.coords;
    console.log(
      `📍 [AutoSOS] Location obtained: ${latitude.toFixed(
        4
      )}, ${longitude.toFixed(4)}`
    );

    // Call API to create SOS
    console.log(`📡 [AutoSOS] Sending SOS to backend...`);
    const sosResponse = await apiService.createSOS({
      latitude,
      longitude,
    });

    console.log(`✅ [AutoSOS] SOS created successfully! ID: ${sosResponse.id}`);

    return {
      success: true,
      sosId: sosResponse.id,
      sos: sosResponse,
      message: `SOS triggered from ${source}: Request sent to nearby ambulances`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ [AutoSOS] Failed to trigger SOS:`, errorMsg);

    return {
      success: false,
      message: `Failed to send SOS: ${errorMsg}`,
    };
  }
}

/**
 * Log SOS trigger event with context
 * Used for analytics and debugging
 */
export function logSOSTriggerEvent(
  source: TriggerSource,
  context: Record<string, any> = {}
): void {
  const timestamp = new Date().toISOString();
  console.log(`📊 [AutoSOS] Event Log [${timestamp}]`, {
    source,
    timestamp,
    ...context,
  });
}
