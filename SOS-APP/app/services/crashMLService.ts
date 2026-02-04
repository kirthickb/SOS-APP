/**
 * ============================================================================
 * CRASH ML SERVICE
 * ============================================================================
 *
 * Purpose:
 * Monitors vehicle acceleration and GPS speed in real-time to detect crashes.
 * Uses Isolation Forest algorithm for anomaly detection.
 *
 * Features:
 * - Reads GPS speed from expo-location
 * - Reads accelerometer data from expo-sensors
 * - Computes anomaly score every second when Driving Mode enabled
 * - Triggers 5-second verification when score > threshold
 * - Calls triggerSOS if anomaly persists with low speed
 *
 * Workflow:
 * 1. Enable driving mode
 * 2. Service samples GPS speed and accelerometer every 1 second
 * 3. Computes motion magnitude: sqrt(x² + y² + z²)
 * 4. Calculates deltaSpeed (rate of change)
 * 5. Gets anomaly score from pre-trained Isolation Forest
 * 6. If score > 0.7, starts 5-second verification window
 * 7. If anomaly persists during verification and speed drops, triggers SOS
 */

import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";
import IsolationForest from "../ml/isolationForest";
import { CrashFeature, CrashDetectionConfig } from "../ml/anomalyTypes";

type CrashDetectionCallback = (reason: string) => void;

interface CrashMLServiceConfig extends Partial<CrashDetectionConfig> {
  onCrashDetected?: CrashDetectionCallback;
  onAnomalyScoreUpdate?: (score: number) => void;
  onError?: (error: string) => void;
}

class CrashMLService {
  private config: CrashMLServiceConfig = {};
  private isolationForest: IsolationForest;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  // State tracking
  private lastSpeed = 0;
  private lastAccelerometerData = { x: 0, y: 0, z: 0 };
  private accumulatedAnomalies: number[] = [];
  private verificationActive = false;
  private verificationStartTime = 0;
  private anomalyScoreHistory: number[] = [];

  // Configuration defaults
  private readonly DEFAULT_CONFIG: CrashDetectionConfig = {
    anomalyScoreThreshold: 0.7,
    verificationDurationSeconds: 5,
    samplingIntervalMs: 1000, // 1 second
    minSpeedForCrashDetection: 2, // m/s (avoid false positives at low speed)
  };

  constructor() {
    this.isolationForest = new IsolationForest();
    this.initializeModel();
  }

  /**
   * Initialize Isolation Forest with hardcoded normal driving data
   */
  private initializeModel(): void {
    console.log("🚗 [CrashMLService] Initializing Isolation Forest model...");

    // Hardcoded normal driving data samples
    // Collected from typical safe driving patterns
    const normalDrivingData: CrashFeature[] = [
      // Steady cruising at different speeds
      { speed: 10, motion: 0.5, deltaSpeed: 0 },
      { speed: 15, motion: 0.6, deltaSpeed: 0.1 },
      { speed: 20, motion: 0.7, deltaSpeed: 0 },
      { speed: 25, motion: 0.8, deltaSpeed: -0.1 },
      { speed: 30, motion: 1.0, deltaSpeed: 0 },
      { speed: 35, motion: 1.2, deltaSpeed: 0.2 },
      { speed: 40, motion: 1.5, deltaSpeed: 0 },
      { speed: 45, motion: 1.8, deltaSpeed: -0.1 },
      { speed: 50, motion: 2.0, deltaSpeed: 0 },
      { speed: 55, motion: 2.2, deltaSpeed: 0.1 },

      // Smooth acceleration
      { speed: 5, motion: 0.8, deltaSpeed: 1.0 },
      { speed: 10, motion: 1.2, deltaSpeed: 0.8 },
      { speed: 15, motion: 1.5, deltaSpeed: 0.6 },
      { speed: 20, motion: 1.8, deltaSpeed: 0.4 },
      { speed: 25, motion: 2.0, deltaSpeed: 0.3 },
      { speed: 30, motion: 2.2, deltaSpeed: 0.2 },

      // Smooth deceleration
      { speed: 50, motion: 2.0, deltaSpeed: -0.5 },
      { speed: 40, motion: 1.8, deltaSpeed: -0.8 },
      { speed: 30, motion: 1.5, deltaSpeed: -0.9 },
      { speed: 20, motion: 1.2, deltaSpeed: -0.8 },
      { speed: 10, motion: 0.8, deltaSpeed: -0.6 },
      { speed: 5, motion: 0.5, deltaSpeed: -0.4 },

      // Turns and gentle maneuvers
      { speed: 25, motion: 3.5, deltaSpeed: -0.2 }, // Left turn
      { speed: 25, motion: 3.2, deltaSpeed: 0.1 }, // Right turn
      { speed: 35, motion: 4.0, deltaSpeed: 0 }, // Sharper turn
      { speed: 15, motion: 2.5, deltaSpeed: 0.3 }, // Low speed turn

      // Normal driving variations (20 more samples for robustness)
      { speed: 12, motion: 0.7, deltaSpeed: 0.05 },
      { speed: 18, motion: 0.9, deltaSpeed: -0.05 },
      { speed: 28, motion: 1.1, deltaSpeed: 0.15 },
      { speed: 32, motion: 1.3, deltaSpeed: -0.1 },
      { speed: 38, motion: 1.6, deltaSpeed: 0.08 },
      { speed: 42, motion: 1.7, deltaSpeed: -0.12 },
      { speed: 48, motion: 1.95, deltaSpeed: 0.05 },
      { speed: 22, motion: 1.4, deltaSpeed: 0.3 },
      { speed: 26, motion: 3.8, deltaSpeed: -0.15 },
      { speed: 16, motion: 2.2, deltaSpeed: 0.2 },
      { speed: 11, motion: 0.65, deltaSpeed: 0 },
      { speed: 19, motion: 0.95, deltaSpeed: -0.08 },
      { speed: 31, motion: 1.25, deltaSpeed: 0.12 },
      { speed: 37, motion: 1.55, deltaSpeed: -0.1 },
      { speed: 44, motion: 1.75, deltaSpeed: 0.1 },
      { speed: 24, motion: 1.05, deltaSpeed: 0.2 },
      { speed: 17, motion: 2.4, deltaSpeed: -0.2 },
      { speed: 21, motion: 1.2, deltaSpeed: 0.25 },
      { speed: 29, motion: 1.35, deltaSpeed: -0.15 },
      { speed: 33, motion: 3.6, deltaSpeed: 0.05 },
    ];

    try {
      this.isolationForest.fit(normalDrivingData);
      console.log(
        "✅ [CrashMLService] Model ready with",
        normalDrivingData.length,
        "training samples"
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        "❌ [CrashMLService] Model initialization failed:",
        errorMsg
      );
      this.config.onError?.(errorMsg);
    }
  }

  /**
   * Initialize the crash detection service
   */
  initialize(config: CrashMLServiceConfig): void {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    console.log("🚗 [CrashMLService] Initialized with config:", this.config);
  }

  /**
   * Start monitoring for crashes
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.log("🚗 [CrashMLService] Already monitoring");
      return;
    }

    this.isMonitoring = true;
    this.accumulatedAnomalies = [];
    this.anomalyScoreHistory = [];
    console.log("🚗 [CrashMLService] Starting crash detection monitoring...");

    // Set up accelerometer updates
    Accelerometer.setUpdateInterval(this.config.samplingIntervalMs || 1000);

    // Sample every configured interval (default 1 second)
    this.monitoringInterval = setInterval(
      () => this.performCrashDetectionCycle(),
      this.config.samplingIntervalMs || 1000
    );
  }

  /**
   * Stop monitoring for crashes
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log("🚗 [CrashMLService] Not currently monitoring");
      return;
    }

    this.isMonitoring = false;
    console.log("🚗 [CrashMLService] Stopping crash detection monitoring");

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.verificationActive = false;
    this.accumulatedAnomalies = [];
  }

  /**
   * Main crash detection cycle - runs every 1 second
   */
  private async performCrashDetectionCycle(): Promise<void> {
    try {
      // Get current GPS speed
      const location = await Location.getLastKnownPositionAsync();
      const currentSpeed = location?.coords.speed || 0;

      // Get accelerometer data
      const accelerometerData = await new Promise<{
        x: number;
        y: number;
        z: number;
      }>((resolve) => {
        const subscription = Accelerometer.addListener((data) => {
          subscription.remove();
          resolve(data);
        });

        // Timeout fallback
        setTimeout(() => {
          subscription.remove();
          resolve({ x: 0, y: 0, z: 0 });
        }, 500);
      });

      // Calculate features
      const motion = Math.sqrt(
        accelerometerData.x ** 2 +
          accelerometerData.y ** 2 +
          accelerometerData.z ** 2
      );

      const deltaSpeed = currentSpeed - this.lastSpeed;

      // Build feature vector
      const feature: CrashFeature = {
        speed: currentSpeed,
        motion,
        deltaSpeed,
      };

      // Update tracking
      this.lastSpeed = currentSpeed;
      this.lastAccelerometerData = accelerometerData;

      // Only analyze if moving fast enough
      const threshold = this.config.minSpeedForCrashDetection || 2;
      if (currentSpeed < threshold) {
        console.debug(
          "🚗 [CrashMLService] Speed too low for crash detection:",
          currentSpeed.toFixed(2),
          "m/s"
        );
        return;
      }

      // Get anomaly score
      const anomalyScore = this.isolationForest.getAnomalyScore(feature);
      this.anomalyScoreHistory.push(anomalyScore);

      // Keep only last 10 scores
      if (this.anomalyScoreHistory.length > 10) {
        this.anomalyScoreHistory.shift();
      }

      // Notify about score update
      this.config.onAnomalyScoreUpdate?.(anomalyScore);

      console.log(
        `🚗 [CrashMLService] Speed: ${currentSpeed.toFixed(
          2
        )}m/s | Motion: ${motion.toFixed(2)} | ΔSpeed: ${deltaSpeed.toFixed(
          2
        )}m/s² | Anomaly Score: ${anomalyScore.toFixed(3)}`
      );

      // Check if anomaly detected
      const anomalyThreshold = this.config.anomalyScoreThreshold || 0.7;

      if (anomalyScore > anomalyThreshold) {
        this.accumulatedAnomalies.push(anomalyScore);
        console.warn(
          `⚠️ [CrashMLService] Anomaly detected! Score: ${anomalyScore.toFixed(
            3
          )} (threshold: ${anomalyThreshold})`
        );

        // Start verification if not already active
        if (!this.verificationActive) {
          this.verificationActive = true;
          this.verificationStartTime = Date.now();
          console.warn(
            `📊 [CrashMLService] Starting 5-second verification window...`
          );
        }
      } else {
        // Clear if score returns to normal
        if (this.verificationActive && this.accumulatedAnomalies.length > 0) {
          this.accumulatedAnomalies.pop();
        }
      }

      // Check verification window
      if (this.verificationActive) {
        const verificationDuration =
          (this.config.verificationDurationSeconds || 5) * 1000;
        const elapsedTime = Date.now() - this.verificationStartTime;

        if (elapsedTime >= verificationDuration) {
          // Verification window complete
          const anomalyPercentage =
            (this.accumulatedAnomalies.length / 5) * 100;

          console.log(
            `📊 [CrashMLService] Verification complete. Anomaly count: ${
              this.accumulatedAnomalies.length
            }/5 (${anomalyPercentage.toFixed(0)}%)`
          );

          // Trigger SOS if conditions met:
          // - Multiple anomalies detected (60%+ of verification window)
          // - Current speed is low (indicates impact/stop)
          if (anomalyPercentage >= 60 && currentSpeed < 3) {
            console.error(
              `🚨 [CrashMLService] CRASH DETECTED! Multiple anomalies + low speed`
            );
            this.config.onCrashDetected?.(
              `Crash detected: anomaly=${anomalyPercentage.toFixed(
                0
              )}%, speed=${currentSpeed.toFixed(2)}m/s`
            );
          } else {
            console.log(
              `✅ [CrashMLService] Verification failed crash criteria. Not triggering SOS.`
            );
          }

          // Reset verification
          this.verificationActive = false;
          this.accumulatedAnomalies = [];
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("🚗 [CrashMLService] Error in detection cycle:", errorMsg);
      this.config.onError?.(errorMsg);
    }
  }

  /**
   * Get current anomaly score history (for debugging)
   */
  getAnomalyScoreHistory(): number[] {
    return [...this.anomalyScoreHistory];
  }

  /**
   * Get monitoring state
   */
  getIsMonitoring(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get verification state
   */
  getIsVerifying(): boolean {
    return this.verificationActive;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopMonitoring();
    console.log("🚗 [CrashMLService] Destroyed");
  }
}

// Export singleton instance
const crashMLService = new CrashMLService();

export default crashMLService;
export type { CrashMLServiceConfig };
