import { useEffect, useRef, useState } from "react";
import { Accelerometer, AccelerometerMeasurement } from "expo-sensors";
import * as Location from "expo-location";
import { feedReading, isCrashModelReady } from "../services/crashMLService";
import { CrashFeature } from "../ml/anomalyTypes";

type UseCrashMLResult = {
  isMonitoring: boolean;
  latestAnomalyScore: number;
};

// PRODUCTION CONFIG
const SAMPLING_INTERVAL_MS = 200; // 5Hz
const GRAVITY = 9.80665;
const MOTION_SMOOTHING_ALPHA = 0.3;

export const useCrashML = (
  enabled: boolean,
  onCrashDetected: () => void
): UseCrashMLResult => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [latestAnomalyScore, setLatestAnomalyScore] = useState(0);

  const speedRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const previousMotionRef = useRef(GRAVITY);
  const totalSamplesRef = useRef(0);
  const onCrashDetectedRef = useRef(onCrashDetected);
  
  // Location subscription for real speed
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    onCrashDetectedRef.current = onCrashDetected;
  }, [onCrashDetected]);

  useEffect(() => {
    if (!enabled) {
      stopMonitoring();
      return;
    }

    startMonitoring();

    return () => {
      stopMonitoring();
    };
  }, [enabled]);

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setLatestAnomalyScore(0);
    
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
  };

  const startMonitoring = async () => {
    const isAvailable = await Accelerometer.isAvailableAsync();
    if (!isAvailable) {
      console.warn("⚠️ [useCrashML] Accelerometer not available");
      return;
    }

    setIsMonitoring(true);
    speedRef.current = 0;
    previousMotionRef.current = GRAVITY;
    totalSamplesRef.current = 0;

    console.log(
      `🚗 [useCrashML] Monitoring enabled | modelReady=${isCrashModelReady()}`
    );

    // Get real GPS speed updates
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          { 
            accuracy: Location.Accuracy.High, 
            timeInterval: 1000, 
            distanceInterval: 1 
          },
          (location) => {
            if (location.coords.speed !== null) {
              speedRef.current = location.coords.speed;
            }
          }
        );
      }
    } catch (e) {
      console.warn("⚠️ [useCrashML] Location error:", e);
    }

    Accelerometer.setUpdateInterval(SAMPLING_INTERVAL_MS);
    const subscription = Accelerometer.addListener((reading: AccelerometerMeasurement) => {
      const now = Date.now();
      const dt = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;

      const { x, y, z } = reading;
      const rawMotion = Math.sqrt(x * x + y * y + z * z) * GRAVITY;
      
      // Filter motion
      const motion = previousMotionRef.current * (1 - MOTION_SMOOTHING_ALPHA) + rawMotion * MOTION_SMOOTHING_ALPHA;
      
      // Calculate deltaSpeed (acceleration) based on motion change
      // Use estimated dt to handle jitter
      const deltaSpeed = (motion - previousMotionRef.current) / (dt || 0.2);

      const feature: CrashFeature = {
        speed: speedRef.current,
        motion,
        deltaSpeed,
      };

      const result = feedReading(feature);
      setLatestAnomalyScore(result.anomalyScore);
      totalSamplesRef.current += 1;

      if (result.isCrash) {
        console.error("🚨 [useCrashML] CRASH CONFIRMED by production detector!", result);
        onCrashDetectedRef.current();
      }

      previousMotionRef.current = motion;

      // Periodic debug log
      if (totalSamplesRef.current % 15 === 0) {
        console.log(
          `🚗 [useCrashML] score=${result.anomalyScore.toFixed(3)} speed=${speedRef.current.toFixed(1)} motion=${motion.toFixed(1)} status=${result.suppressedReason || 'OK'}`
        );
      }
    });

    return () => {
      subscription.remove();
    };
  };

  return {
    isMonitoring,
    latestAnomalyScore,
  };
};

