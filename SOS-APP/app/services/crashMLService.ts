import { CrashFeature, CrashDetectionResult } from "../ml/anomalyTypes";
import { CrashDetector } from "../ml/crashDetector";
import { REAL_DRIVING_MOTION_SAMPLES } from "../ml/baselineData";

const detector = new CrashDetector();
let modelReady = false;
let hasWarnedModelNotReady = false;

const randomBetween = (min: number, max: number): number => {
  return min + Math.random() * (max - min);
};

/**
 * Generates training data using real-world accelerometer baseline
 * Combined with synthetic speed/deltaSpeed patterns
 */
const generateTrainingData = (): CrashFeature[] => {
  const data: CrashFeature[] = [];

  // Use the 500 real motion samples as the foundation
  REAL_DRIVING_MOTION_SAMPLES.forEach((motion, index) => {
    let speed = 0;
    let deltaSpeed = 0;

    // Distribute into driving phases based on index
    if (index < 100) {
      speed = randomBetween(0, 0.2);
      deltaSpeed = randomBetween(-0.05, 0.05);
    } 
    else if (index < 400) {
      speed = randomBetween(5, 30);
      deltaSpeed = randomBetween(-0.3, 0.3);
    }
    else {
      speed = randomBetween(2, 12);
      deltaSpeed = randomBetween(-1.5, 1.0);
    }

    data.push({ speed, motion, deltaSpeed });
  });

  return data;
};

const trainModel = (): void => {
  try {
    const trainingData = generateTrainingData();
    detector.train(trainingData);
    modelReady = true;
    console.log(
      `🚗 [CrashML] Production CrashDetector ready with ${trainingData.length} baseline samples.`
    );
  } catch (error) {
    modelReady = false;
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ [CrashML] Model training failed:", message);
  }
};

// Initial training
trainModel();

/**
 * Feed a sensor reading into the detector and get results
 */
export function feedReading(feature: CrashFeature): CrashDetectionResult {
  if (!modelReady) {
    if (!hasWarnedModelNotReady) {
      console.warn("⚠️ [CrashML] feedReading() called before model ready");
      hasWarnedModelNotReady = true;
    }
    // Return a dummy safe result
    return {
      isCrash: false,
      anomalyScore: 0.5,
      gatesPassed: { speed: false, impact: false, deceleration: false, recovery: false },
      confidence: 'low',
      suppressedReason: 'model not ready'
    };
  }

  return detector.feed(feature);
}

export function isCrashModelReady(): boolean {
  return modelReady;
}

const crashMLService = {
  feedReading,
  isCrashModelReady,
  exportModel: () => detector.exportModel(),
  importModel: (json: string) => detector.importModel(json)
};

export default crashMLService;


