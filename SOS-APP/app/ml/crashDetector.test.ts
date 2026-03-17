import { CrashDetector } from './crashDetector';
import { CrashFeature } from './anomalyTypes';

/**
 * 🧪 Unit Test Cases for CrashDetector
 */
export function runCrashDetectorTests() {
  const detector = new CrashDetector();
  const KMH_TO_MS = 1 / 3.6;

  // 1. Prepare Training Data (Normal Driving)
  const trainingData: CrashFeature[] = [];
  for (let i = 0; i < 300; i++) {
    trainingData.push({
      speed: 13.8, // 50 km/h
      motion: 9.8 + (Math.random() * 2.0 - 1.0), // Normal-ish vibration
      deltaSpeed: Math.random() * 0.5 - 0.25
    });
  }
  
  console.log("🧪 Starting Tests...");
  detector.train(trainingData);

  // Helper to feed multiple frames with jitter to avoid sensor freeze detection
  const feedSequence = (feature: CrashFeature, count: number) => {
    let lastResult;
    for (let i = 0; i < count; i++) {
        // Add tiny jitter so sensor freeze doesn't trigger
        const noisyFeature = {
            ...feature,
            motion: feature.motion + (Math.random() * 0.002 - 0.001)
        };
        lastResult = detector.feed(noisyFeature);
        // If we found a crash, return it immediately so we don't hit repeat suppression on next frames
        if (lastResult.isCrash) return lastResult;
    }
    return lastResult;
  };

  const getHighScoresCount = () => {
     // @ts-ignore - accessing private for debugging test
     return detector.scoreHistory.filter(s => s >= 0.45).length;
  };

  // --- TEST 1: Phone shaken while stationary ---
  // Result expectation: isCrash: false (speed gate blocks it)
  const shakingReading: CrashFeature = {
    speed: 0,
    motion: 25.0, // High impact
    deltaSpeed: 0
  };
  const res1 = feedSequence(shakingReading, 5);
  console.log("Test 1 (Stationary Shake):", res1?.isCrash === false ? "PASSED ✅" : "FAILED ❌", `(Reason: ${res1?.suppressedReason || 'None'})`);

  // --- TEST 2: Hard brake at 60 km/h ---
  // Result expectation: isCrash: true
  
  // Fill history with normal driving at 60 km/h so stillness check passes
  const preCrashReading: CrashFeature = { speed: 16.6, motion: 9.8, deltaSpeed: 0 };
  for (let i = 0; i < 15; i++) detector.feed({ ...preCrashReading, motion: preCrashReading.motion + Math.random() * 0.01 });

  const hardBrakeReading: CrashFeature = {
    speed: 16.6, // 60 km/h
    motion: 30.0, // Significant impact/movement
    deltaSpeed: -8.5 * KMH_TO_MS // Deceleration over threshold
  };
  
  const res2 = feedSequence(hardBrakeReading, 5);
  
  console.log("Test 2 (Hard Brake):", res2?.isCrash === true ? "PASSED ✅" : "FAILED ❌", `(Score: ${res2?.anomalyScore.toFixed(3)}, HighScores: ${getHighScoresCount()}, Reason: ${res2?.suppressedReason || 'None'}, Gates: ${JSON.stringify(res2?.gatesPassed)})`);
  
  // --- TEST 3: Pothole at 30 km/h ---
  // Result expectation: isCrash: false (deceleration gate blocks it)
  const potholeReading: CrashFeature = {
    speed: 8.3, // 30 km/h
    motion: 35.0, // Huge spike
    deltaSpeed: -2 * KMH_TO_MS // Low deceleration
  };
  const res3 = feedSequence(potholeReading, 5);
  console.log("Test 3 (Pothole):", res3?.isCrash === false ? "PASSED ✅" : "FAILED ❌", `(Gates: spd:${res3?.gatesPassed.speed}, imp:${res3?.gatesPassed.impact}, dec:${res3?.gatesPassed.deceleration})`);

  // --- TEST 4: Sensor freeze event ---
  // Result expectation: readings discarded silently
  const frozenReading: CrashFeature = { speed: 10, motion: 9.6, deltaSpeed: 0 };
  detector.feed(frozenReading);
  detector.feed(frozenReading);
  detector.feed(frozenReading); // 3rd time
  const res4 = detector.feed(frozenReading); // 4th time
  console.log("Test 4 (Sensor Freeze):", res4?.suppressedReason === "Sensor freeze detected" ? "PASSED ✅" : "FAILED ❌");
}
