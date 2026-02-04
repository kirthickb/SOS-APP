/**
 * ============================================================================
 * USE CRASH ML HOOK
 * ============================================================================
 *
 * Purpose:
 * React hook to integrate Crash ML detection service into components.
 * Manages initialization, cleanup, and state synchronization.
 *
 * Usage:
 * const { isMonitoring, anomalyScore, error } = useCrashML(drivingModeEnabled, onCrashDetected);
 */

import { useEffect, useState, useRef } from "react";
import crashMLService from "../services/crashMLService";

interface UseCrashMLOptions {
  anomalyScoreThreshold?: number;
  verificationDurationSeconds?: number;
  onError?: (error: string) => void;
}

interface UseCrashMLResult {
  isMonitoring: boolean;
  isVerifying: boolean;
  latestAnomalyScore: number;
  anomalyScoreHistory: number[];
  error: string | null;
}

/**
 * Hook to manage Crash ML detector
 * @param enabled - Whether to enable crash detection
 * @param onCrashDetected - Callback when crash is detected
 * @param options - Configuration options
 */
export const useCrashML = (
  enabled: boolean,
  onCrashDetected: () => void,
  options: UseCrashMLOptions = {}
): UseCrashMLResult => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [latestAnomalyScore, setLatestAnomalyScore] = useState(0);
  const [anomalyScoreHistory, setAnomalyScoreHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const anomalyScoreThreshold = options.anomalyScoreThreshold || 0.7;
  const verificationDurationSeconds = options.verificationDurationSeconds || 5;

  useEffect(() => {
    // Initialize service only once
    if (!initializedRef.current) {
      crashMLService.initialize({
        anomalyScoreThreshold,
        verificationDurationSeconds,
        onCrashDetected: (reason) => {
          console.log("🚗 [useCrashML] Crash detected:", reason);
          onCrashDetected();
        },
        onAnomalyScoreUpdate: (score) => {
          setLatestAnomalyScore(score);
        },
        onError: (err) => {
          console.error("🚗 [useCrashML] Error:", err);
          setError(err);
          options.onError?.(err);
        },
      });
      initializedRef.current = true;
    }

    // Start or stop monitoring based on enabled flag
    if (enabled) {
      console.log("🚗 [useCrashML] Starting crash detection monitoring");
      crashMLService.startMonitoring();
      setIsMonitoring(true);

      // Update state periodically to reflect monitoring status
      updateIntervalRef.current = setInterval(() => {
        setIsMonitoring(crashMLService.getIsMonitoring());
        setIsVerifying(crashMLService.getIsVerifying());
        setAnomalyScoreHistory(crashMLService.getAnomalyScoreHistory());
      }, 1000);
    } else {
      console.log("🚗 [useCrashML] Stopping crash detection monitoring");
      crashMLService.stopMonitoring();
      setIsMonitoring(false);
      setIsVerifying(false);

      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    }

    // Cleanup on unmount
    return () => {
      crashMLService.stopMonitoring();
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [
    enabled,
    anomalyScoreThreshold,
    verificationDurationSeconds,
    onCrashDetected,
    options,
  ]);

  return {
    isMonitoring,
    isVerifying,
    latestAnomalyScore,
    anomalyScoreHistory,
    error,
  };
};
