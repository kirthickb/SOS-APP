/**
 * ============================================================================
 * CRASH DETECTION DEBUG SCREEN
 * ============================================================================
 *
 * In-app testing interface for production crash detection
 * Provides manual test triggers and real-time validation gate visualization
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { CrashDetector } from "../ml/crashDetector";
import { CrashFeature, CrashDetectionResult } from "../ml/anomalyTypes";
import { REAL_DRIVING_MOTION_SAMPLES } from "../ml/baselineData";
import { runCrashDetectorTests } from "../ml/crashDetector.test";

interface TestLog {
  timestamp: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  result?: CrashDetectionResult;
}

const GRAVITY = 9.80665;
const KMH_TO_MS = 1 / 3.6;

export default function CrashDetectionDebugScreen() {
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);
  const [lastResult, setLastResult] = useState<CrashDetectionResult | null>(null);
  const [detector, setDetector] = useState<CrashDetector | null>(null);

  const addLog = useCallback((message: string, type: TestLog["type"] = "info", result?: CrashDetectionResult) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [
      { timestamp: time, message, type, result },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const initializeModel = useCallback(() => {
    try {
      const normalDrivingData: CrashFeature[] = REAL_DRIVING_MOTION_SAMPLES.map((motion, index) => {
        let speed = 25 * KMH_TO_MS; // 25 km/h
        let deltaSpeed = 0;
        
        if (index < 100) speed = 0;
        else if (index > 450) speed = 10 * KMH_TO_MS;
        
        return { speed, motion, deltaSpeed };
      });

      const newDetector = new CrashDetector();
      newDetector.train(normalDrivingData);
      setDetector(newDetector);
      setIsModelReady(true);
      addLog(`✅ Production Detector ready with ${normalDrivingData.length} samples`, "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      addLog(`❌ Init failed: ${msg}`, "error");
    }
  }, [addLog]);

  // Initialize model on screen load
  useEffect(() => {
    initializeModel();
  }, [initializeModel]);

  const runTest = useCallback((feature: CrashFeature, name: string, frames: number = 5) => {
    if (!detector) {
      addLog("Detector not ready", "error");
      return;
    }

    let finalRes: CrashDetectionResult | null = null;
    for (let i = 0; i < frames; i++) {
        // Feed frames to populate history
        finalRes = detector.feed(feature);
    }

    if (finalRes) {
      setLastResult(finalRes);
      const type = finalRes.isCrash ? "error" : finalRes.anomalyScore > 0.72 ? "warning" : "info";
      addLog(
        `[${name}] Score: ${finalRes.anomalyScore.toFixed(3)} | Result: ${finalRes.isCrash ? "🚨 CRASH" : "✅ SAFE"}`,
        type,
        finalRes
      );
    }
  }, [detector, addLog]);

  const testNormalDriving = () => {
    addLog("--- TESTING NORMAL DRIVING ---", "info");
    runTest({ speed: 40 * KMH_TO_MS, motion: 9.8, deltaSpeed: 0.1 }, "Cruising 40km/h");
    runTest({ speed: 20 * KMH_TO_MS, motion: 10.5, deltaSpeed: 1.5 }, "Smooth Acceleration");
  };

  const testShakingStationary = () => {
    addLog("--- TESTING STATIONARY SHAKING ---", "warning");
    runTest({ speed: 0, motion: 35.0, deltaSpeed: 0 }, "Hard Shake (0 km/h)");
  };

  const testPothole = () => {
    addLog("--- TESTING POTHOLE IMPACT ---", "warning");
    runTest({ speed: 30 * KMH_TO_MS, motion: 40.0, deltaSpeed: -2 * KMH_TO_MS }, "Heavy Pothole (High Motion, Low Decel)");
  };

  const testCrashScenario = () => {
    addLog("--- SIMULATING CRASH EVENT ---", "error");
    // Pre-impact
    runTest({ speed: 60 * KMH_TO_MS, motion: 9.9, deltaSpeed: 0 }, "Pre-impact (60km/h)", 1);
    // Impact frame
    setTimeout(() => {
        runTest({ speed: 45 * KMH_TO_MS, motion: 4.5 * GRAVITY, deltaSpeed: -15 * KMH_TO_MS }, "IMPACT (4.5G)", 5);
    }, 200);
  };

  const testInternalLogic = () => {
    addLog("--- RUNNING INTERNAL UNIT TESTS (CONSOLE) ---", "info");
    try {
        runCrashDetectorTests();
        addLog("Tests initiated. Check console for detailed logs.", "success");
    } catch (e) {
        addLog(`Test suite error: ${e}`, "error");
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setLastResult(null);
  };

  const getStatusColor = (res: CrashDetectionResult): string => {
    if (res.isCrash) return "#CC0000";
    if (res.suppressedReason) return "#FF6600";
    if (res.anomalyScore > 0.72) return "#FFAA00";
    return "#00CC00";
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>🧪 Production Detector Debug</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: isModelReady ? "#00CC00" : "#CC0000" },
              ]}
            />
            <Text style={styles.statusText}>
              {isModelReady ? "System Active" : "Initializing..."}
            </Text>
          </View>
        </View>

        {lastResult && (
          <View
            style={[
              styles.scoreDisplay,
              { backgroundColor: getStatusColor(lastResult) + "20" },
              { borderColor: getStatusColor(lastResult) },
            ]}
          >
            <Text style={styles.scoreLabel}>
              {lastResult.isCrash ? "🚨 CRASH DETECTED" : lastResult.suppressedReason ? "🚫 SUPPRESSED" : "✅ NORMAL"}
            </Text>
            <Text style={[styles.scoreValue, { color: getStatusColor(lastResult) }]}>
              {(lastResult.anomalyScore * 100).toFixed(1)}%
            </Text>
            
            <View style={styles.gatesGrid}>
               <GateItem label="Speed" pass={lastResult.gatesPassed.speed} />
               <GateItem label="Impact" pass={lastResult.gatesPassed.impact} />
               <GateItem label="Decel" pass={lastResult.gatesPassed.deceleration} />
               <GateItem label="Recovery" pass={lastResult.gatesPassed.recovery} />
            </View>

            {lastResult.suppressedReason && (
              <Text style={styles.reasonText}>Reason: {lastResult.suppressedReason}</Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Simulations</Text>

          <TouchableOpacity
            style={[styles.button, styles.buttonInfo]}
            onPress={testNormalDriving}
          >
            <Text style={styles.buttonText}>✓ Normal Driving</Text>
            <Text style={styles.buttonHint}>Passes Anomaly Gate 🟢</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonWarning]}
            onPress={testShakingStationary}
          >
            <Text style={styles.buttonText}>📳 Shake @ 0 km/h</Text>
            <Text style={styles.buttonHint}>Blocked by Speed Gate 🔴</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonWarning]}
            onPress={testPothole}
          >
            <Text style={styles.buttonText}>🕳️ Big Pothole</Text>
            <Text style={styles.buttonHint}>Blocked by Decel Gate 🔴</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={testCrashScenario}
          >
            <Text style={styles.buttonText}>🚨 Severe Collision</Text>
            <Text style={styles.buttonHint}>Triggers SOS 🚨</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonInfo, { marginTop: 16 }]}
            onPress={testInternalLogic}
          >
            <Text style={styles.buttonText}>📑 Run Internal Test Suite</Text>
            <Text style={styles.buttonHint}>Validates all gates (Console Output)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.infoToggle}>
            <Text style={styles.sectionTitle}>Production Heuristics</Text>
            <Switch
              value={showDetailedInfo}
              onValueChange={setShowDetailedInfo}
              trackColor={{ false: "#404040", true: "#00D4FF" }}
            />
          </View>

          {showDetailedInfo && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Sliding Window:</Text> 3 of last 5 frames must be anomalous.
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Cleaning:</Text> IQR outlier removal + Sensor Freeze detection.
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Speed Gate:</Text> Must be &gt; 15 km/h at impact.
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Decel Gate:</Text> Must exceed 8 km/h per second reduction.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.logsHeader}>
            <Text style={styles.sectionTitle}>Execution Logs</Text>
            <TouchableOpacity onPress={clearLogs} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          {logs.length === 0 ? (
            <Text style={styles.emptyLogs}>Trigger a simulation above...</Text>
          ) : (
            logs.map((log, index) => (
              <View key={index} style={[styles.log, styles[`log${log.type}`]]}>
                <Text style={styles.logTime}>{log.timestamp}</Text>
                <Text style={styles.logMessage}>{log.message}</Text>
                {log.result && log.result.suppressedReason && (
                    <Text style={styles.logSubtext}>→ {log.result.suppressedReason}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function GateItem({ label, pass }: { label: string; pass: boolean }) {
    return (
        <View style={styles.gateItem}>
            <Text style={styles.gateLabel}>{label}</Text>
            <Text style={[styles.gateStatus, { color: pass ? "#00CC00" : "#CC0000" }]}>
                {pass ? "PASS" : "FAIL"}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  scroll: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00D4FF",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    color: "#00D4FF",
    fontSize: 14,
    fontWeight: "600",
  },
  scoreDisplay: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    alignItems: "center",
  },
  scoreLabel: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    opacity: 0.8,
  },
  scoreValue: {
    fontSize: 54,
    fontWeight: "bold",
    marginBottom: 12,
  },
  gatesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    width: "100%",
    marginTop: 8,
  },
  gateItem: {
    backgroundColor: "#00000040",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 70,
  },
  gateLabel: {
    color: "#999",
    fontSize: 10,
    fontWeight: "bold",
  },
  gateStatus: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },
  reasonText: {
    marginTop: 12,
    color: "#FFAA00",
    fontSize: 13,
    fontWeight: "600",
    fontStyle: "italic",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00D4FF",
    marginBottom: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  buttonInfo: {
    borderColor: "#00D4FF40",
    backgroundColor: "#00D4FF10",
  },
  buttonWarning: {
    borderColor: "#FFAA0040",
    backgroundColor: "#FFAA0010",
  },
  buttonDanger: {
    borderColor: "#CC000040",
    backgroundColor: "#CC000010",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonHint: {
    color: "#999",
    fontSize: 12,
    marginTop: 4,
  },
  infoToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#00D4FF",
  },
  infoText: {
    color: "#AAA",
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  infoBold: {
    color: "#00D4FF",
    fontWeight: "bold",
  },
  logsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  clearButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#404040",
  },
  clearButtonText: {
    color: "#999",
    fontSize: 12,
    fontWeight: "600",
  },
  log: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  loginfo: {
    backgroundColor: "#16213e",
    borderLeftColor: "#00D4FF",
  },
  logwarning: {
    backgroundColor: "#2e2015",
    borderLeftColor: "#FFAA00",
  },
  logerror: {
    backgroundColor: "#2e1515",
    borderLeftColor: "#CC0000",
  },
  logsuccess: {
    backgroundColor: "#152e1a",
    borderLeftColor: "#00CC00",
  },
  logTime: {
    color: "#666",
    fontSize: 11,
    marginBottom: 4,
  },
  logMessage: {
    color: "#EEE",
    fontSize: 13,
    fontWeight: "500",
  },
  logSubtext: {
    color: "#FFAA00",
    fontSize: 11,
    marginTop: 4,
    fontStyle: "italic",
  },
  emptyLogs: {
    color: "#666",
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 13,
  },
});

