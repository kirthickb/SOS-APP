import IsolationForest from './isolationForest';
import { CrashFeature, CrashDetectionResult } from './anomalyTypes';

/**
 * 🧹 Data Cleaning Utility
 */
export function cleanTrainingData(samples: number[]): number[] {
  if (samples.length === 0) return [];
  
  // 1. Remove duplicate/repeated consecutive sensor values (freeze detection)
  const deduped: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    if (i === 0 || samples[i] !== samples[i - 1]) {
      deduped.push(samples[i]);
    }
  }

  if (deduped.length < 4) return deduped;
  
  // 2. Remove statistical outliers using IQR method
  const sorted = [...deduped].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  const thresholded = deduped.filter(x => x >= lowerBound && x <= upperBound);

  // 3. Validate sufficient variance
  if (thresholded.length > 1) {
    const mean = thresholded.reduce((a, b) => a + b, 0) / thresholded.length;
    const variance = thresholded.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / thresholded.length;
    if (variance < 0.0001) {
      console.warn("⚠️ [CrashDetector] Cleaned data has extremely low variance. Sensor may be stuck or environment too stable.");
    }
  }
  
  return thresholded;
}

type Stats = {
  mean: number;
  std: number;
  min: number;
  max: number;
};

type FeatureStats = {
  speed: Stats;
  motion: Stats;
  deltaSpeed: Stats;
};

export class CrashDetector {
  private forest: IsolationForest;
  private stats: FeatureStats | null = null;
  private history: CrashFeature[] = [];
  private scoreHistory: number[] = [];
  private lastTriggerTime: number = 0;
  private consecutiveFreezeCount: number = 0;
  private lastMotionValue: number | null = null;
  
  private readonly WINDOW_SIZE = 5;
  private readonly TRIGGER_THRESHOLD = 3; // 3 of 5
  private readonly ANOMALY_SCORE_CUTOFF = 0.45;
  private readonly REPEAT_SUPPRESSION_MS = 30000;
  private readonly KMH_TO_MS = 1 / 3.6;

  constructor() {
    this.forest = new IsolationForest({ numTrees: 100, sampleSize: 256 });
  }

  /**
   * 🏋️ Model Training Pipeline
   */
  train(data: CrashFeature[]): void {
    if (data.length < 10) {
      console.error("❌ [CrashDetector] Insufficient data for training.");
      return;
    }

    // Prepare stats for each feature using cleaned data
    const speeds = data.map(d => d.speed);
    const motions = data.map(d => d.motion);
    const deltas = data.map(d => d.deltaSpeed);

    const cleanedSpeeds = cleanTrainingData(speeds);
    const cleanedMotions = cleanTrainingData(motions);
    const cleanedDeltas = cleanTrainingData(deltas);

    this.stats = {
      speed: this.calculateStats(cleanedSpeeds.length > 0 ? cleanedSpeeds : speeds),
      motion: this.calculateStats(cleanedMotions.length > 0 ? cleanedMotions : motions),
      deltaSpeed: this.calculateStats(cleanedDeltas.length > 0 ? cleanedDeltas : deltas)
    };

    // Fit with ALL data (including outliers as they might be rare extremes we want in IF)
    // But IF handles outliers naturally.
    this.forest.fit(data);
    console.log("✅ [CrashDetector] Model trained and stats calculated.");
  }

  private calculateStats(values: number[]): Stats {
    if (values.length === 0) return { mean: 0, std: 0, min: 0, max: 0 };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sqDiffs = values.map(v => Math.pow(v - mean, 2));
    const std = Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
    return {
      mean,
      std,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  /**
   * ⚙️ Physics-Based Crash Validator & 🪟 Sliding Window Confirmation
   */
  feed(reading: CrashFeature): CrashDetectionResult {
    // 5. 🚫 False Positive Suppression - Sensor Freeze Detection
    if (this.lastMotionValue !== null && Math.abs(reading.motion - this.lastMotionValue) < 0.0001) {
      this.consecutiveFreezeCount++;
    } else {
      this.consecutiveFreezeCount = 0;
    }
    this.lastMotionValue = reading.motion;

    if (this.consecutiveFreezeCount >= 3) {
      return this.createResult(false, 0, "Sensor freeze detected", { speed: false, impact: false, deceleration: false, recovery: false });
    }

    // Update history
    this.history.push({ ...reading });
    if (this.history.length > 20) this.history.shift(); 

    const score = this.forest.getAnomalyScore(reading);
    this.scoreHistory.push(score);
    if (this.scoreHistory.length > this.WINDOW_SIZE) this.scoreHistory.shift();

    // 4. 🪟 Sliding Window Confirmation
    const highScoresCount = this.scoreHistory.filter(s => s >= this.ANOMALY_SCORE_CUTOFF).length;
    const isAnomalous = highScoresCount >= this.TRIGGER_THRESHOLD;

    if (!isAnomalous) {
      return this.createResult(false, score, undefined, { speed: false, impact: false, deceleration: false, recovery: false });
    }

    // 3. ⚙️ Physics-Based Crash Validator
    if (!this.stats) {
      return this.createResult(false, score, "Model not trained", { speed: false, impact: false, deceleration: false, recovery: false });
    }
    
    const gates = {
      speed: reading.speed > (15 * this.KMH_TO_MS), // Gate 1: > 15 km/h
      impact: reading.motion > (2.5 * this.stats.motion.mean), // Gate 2: > 2.5x mean
      deceleration: Math.abs(reading.deltaSpeed) > (8 * this.KMH_TO_MS), // Gate 3: > 8 km/h/s
      recovery: this.checkRecoveryGate() // Gate 4: motion drops back
    };

    const allGatesPassed = gates.speed && gates.impact && gates.deceleration && gates.recovery;

    // 5. 🚫 False Positive Suppression
    if (allGatesPassed) {
      // Repeat suppression
      const now = Date.now();
      if (now - this.lastTriggerTime < this.REPEAT_SUPPRESSION_MS) {
        return this.createResult(false, score, "Repeat suppression active", gates);
      }
      
      // Stillness check (before event)
      const buffer2sSize = 2000 / 200; // Last 2s
      const previousSpeeds = this.history.slice(-Math.floor(buffer2sSize + 1), -1).map(h => h.speed);
      const wasStill = previousSpeeds.length > 0 && previousSpeeds.every(s => s < (5 * this.KMH_TO_MS));
      
      if (wasStill) {
        return this.createResult(false, score, "Stillness check (pre-event)", gates);
      }

      this.lastTriggerTime = now;
      return this.createResult(true, score, undefined, gates);
    }

    return this.createResult(false, score, "Physics gates not met", gates);
  }

  private checkRecoveryGate(): boolean {
    if (this.history.length < 5) return true; // Not enough history, default open

    const baseline = this.stats?.motion.mean || 9.8;
    // Get recent motion measurements
    const recentMotions = this.history.slice(-10).map(h => h.motion);
    
    // Recovery gate logic: 
    // This proves the motion dropped back down, meaning it was a spike, not a sustained vibration.
    const lowestRecentMotion = Math.min(...recentMotions);
    
    return lowestRecentMotion < (baseline * 1.5); 
  }
  
  private createResult(isCrash: boolean, score: number, reason: string | undefined, gates: CrashDetectionResult['gatesPassed']): CrashDetectionResult {
    let confidence: CrashDetectionResult['confidence'] = 'low';
    if (isCrash) {
      confidence = score > 0.85 ? 'high' : 'medium';
    }

    return {
      isCrash,
      anomalyScore: score,
      gatesPassed: gates,
      confidence,
      suppressedReason: reason
    };
  }

  /**
   * 📦 Model Persistence
   */
  exportModel(): string {
    return JSON.stringify({
      forest: this.forest.exportModel(),
      stats: this.stats,
      lastTriggerTime: this.lastTriggerTime
    });
  }

  importModel(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.forest) {
        this.forest = new IsolationForest();
        this.forest.importModel(data.forest);
      }
      this.stats = data.stats || null;
      this.lastTriggerTime = data.lastTriggerTime || 0;
    } catch (e) {
      console.error("❌ [CrashDetector] Failed to import model", e);
    }
  }
}
