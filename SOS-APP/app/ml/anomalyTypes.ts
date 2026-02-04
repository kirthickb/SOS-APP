/**
 * ============================================================================
 * ANOMALY TYPES
 * ============================================================================
 *
 * Purpose:
 * Type definitions for crash detection ML features.
 */

/**
 * Feature vector for crash detection
 * @property speed - Current GPS speed in m/s
 * @property motion - Magnitude of accelerometer motion: sqrt(x² + y² + z²)
 * @property deltaSpeed - Rate of change of speed (acceleration) in m/s²
 */
export type CrashFeature = {
  speed: number;
  motion: number;
  deltaSpeed: number;
};

/**
 * Single sample point from accelerometer
 */
export type AccelerometerData = {
  x: number;
  y: number;
  z: number;
  timestamp: number;
};

/**
 * Configuration for crash detection
 */
export type CrashDetectionConfig = {
  anomalyScoreThreshold: number; // Score > threshold triggers alert
  verificationDurationSeconds: number; // How long to verify before triggering SOS
  samplingIntervalMs: number; // How often to sample GPS/accelerometer
  minSpeedForCrashDetection: number; // Only detect crashes when speed > this (m/s)
};

/**
 * Result of anomaly detection
 */
export type AnomalyResult = {
  score: number;
  isAnomaly: boolean;
  pathLength: number;
  timestamp: number;
};
