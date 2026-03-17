# Crash Detection Testing Guide (Mobile App)

## Quick Start

### Option 1: In-App Debug Screen (Recommended)

1. **Start the app:**
   ```powershell
   cd .\SOS-APP\
   expo start
   # Select 'a' for Android emulator or 'i' for iOS simulator
   ```

2. **Navigate to Debug Screen:**
   - After login, add `/debug-crash` to your navigation or:
   - Import and use `DebugCrashDetectionScreen` directly
   - Or add a debug menu button to the home screen

3. **Run Test Scenarios:**
   - ✓ Normal Driving (should score 0.45-0.65)
   - ⚠️ Hard Braking (anomaly detection)
   - 🚨 Crash Impact (multi-stage simulation)
   - 🔧 Edge Cases (unusual patterns)

4. **Watch Real-Time Logs:**
   - Anomaly scores update in real-time
   - Visual color indicators: 🟢 Normal / 🟡 Warning / 🔴 Anomaly
   - Detailed test logs at the bottom

**Expected Output:** Clear pass/fail results for each test scenario

---

## Option 2: Manual Testing in the App (Live Sensor Testing)

### Setup

1. **Start the backend:**
   ```powershell
   cd .\sos-backend\
   mvn spring-boot:run
   # Runs on http://localhost:8080
   ```

2. **Start the mobile app:**
   ```powershell
   cd .\SOS-APP\
   expo start
   # Select 'a' for Android emulator or 'i' for iOS simulator
   ```

3. **Login to the app** as a client

4. **Enable Driving Mode:**
   - Home screen → Toggle "🚗 Driving Mode ON" switch
   - Watch Expo console (terminal) for real-time logs or use Android logcat/Xcode

### Viewing Logs During Testing

**Option A: Expo Console (Terminal)**
```
The terminal where you ran 'expo start' will show:
  🚗 [CrashMLService] Speed: 25.5m/s | Motion: 0.8 | Anomaly Score: 0.523
  ⚠️ [CrashMLService] Anomaly detected! Score: 0.78
```

**Option B: Android Emulator (logcat)**
```powershell
adb logcat | findstr "CrashMLService"
```

**Option C: iOS Simulator (Xcode Console)**
```
Open Xcode → Window → Devices and Simulators → Logs
```

**Option D: In-App Debug Screen (Easiest)**
- Use the Debug Crash Detection Screen we created
- Visual display of anomaly scores in real-time
- All test logs displayed on-screen

---

## Integrating the Debug Screen

The `DebugCrashDetectionScreen` is created and ready to use. To add it to your app:

### Quick Integration

Edit `app/navigation/AppNavigator.tsx`:

```typescript
import DebugCrashDetectionScreen from "../screens/DebugCrashDetectionScreen";

// Inside the client bottom tabs navigator, add:
<Tab.Screen
  name="DebugCrash"
  component={DebugCrashDetectionScreen}
  options={{
    title: "Debug 🧪",
    headerShown: false,
  }}
/>
```

Now you'll see a "Debug 🧪" tab on the bottom navigation to access real-time testing.

---

## Test Scenarios

### Scenario 1: Normal Driving (No False Positives)

**Expectation:** Anomaly scores stay below 0.7

**How to test:**
- Enable Driving Mode
- Keep phone stable in car (no sudden movements)
- Take a normal drive for 1-2 minutes
- Observe console logs:
  ```
  🚗 [CrashMLService] Speed: 25.5m/s | Motion: 0.8 | ΔSpeed: 0.1m/s² | Anomaly Score: 0.523
  🚗 [CrashMLService] Speed: 26.2m/s | Motion: 0.9 | ΔSpeed: 0.2m/s² | Anomaly Score: 0.518
  ```

**Pass Condition:** All scores remain < 0.7 (appearing as normal)

---

### Scenario 2: Hard Braking Test (Trigger Verification)

**Expectation:** Anomaly score spikes > 0.7, verification window starts

**How to test:**
1. Enable Driving Mode
2. Drive at moderate speed (20-40 km/h)
3. Perform a **hard brake** (simulating emergency stop)
4. Watch console for:
   ```
   ⚠️ [CrashMLService] Anomaly detected! Score: 0.78 (threshold: 0.7)
   📊 [CrashMLService] Starting 5-second verification window...
   ```

**Pass Condition:** Anomaly is detected and verification starts

**Next Steps:**
- If you stop the car (speed < 3 m/s) within 5 seconds:
  ```
  📊 [CrashMLService] Verification complete. Anomaly count: 4/5 (80%)
  🚨 [CrashMLService] CRASH DETECTED! Multiple anomalies + low speed
  ```
  SOS should be triggered automatically

---

### Scenario 3: Sudden Acceleration Test (Edge Case)

**Expectation:** May trigger anomaly, but should clear if normal again

**How to test:**
1. Enable Driving Mode
2. Perform aggressive acceleration (0-30 km/h in <2 seconds)
3. Watch console for anomaly spike
4. Return to normal speed
5. Verify anomaly clears without SOS

**Expected Logs:**
```
⚠️ [CrashMLService] Anomaly detected! Score: 0.75
📊 [CrashMLService] Starting 5-second verification window...
✅ [CrashMLService] Verification failed crash criteria. Not triggering SOS.
```

---

### Scenario 4: Driving Through Rough Terrain (Vibration Test)

**Expectation:** High motion readings, but balanced with speed metrics

**How to test:**
1. Enable Driving Mode
2. Drive through bumpy/pothole area (maintains speed)
3. Observe anomaly scores spike but not consistently

**Expected Behavior:**
- Anomaly may hit 0.6-0.7 from vibration
- But will NOT trigger SOS because:
  - Doesn't meet 60% threshold in 5-second window
  - Speed stays above 3 m/s

---

### Scenario 5: Realistic Crash Simulation (Recommended)

**Expectation:** Multi-stage detection exactly matching real crash pattern

**How to test:**
1. Enable Driving Mode
2. Drive at 40+ km/h
3. Perform sequence:
   - **T+0s:** Normal driving
   - **T+1s:** Sudden hard deceleration (simulating impact)
   - **T+2-4s:** Keep speed low (< 5 km/h) to simulate post-crash stop
4. Watch console timeline:

```
t=0s  🚗 [CrashMLService] Speed: 42.5m/s | Motion: 1.6 | Anomaly Score: 0.512
t=1s  ⚠️  [CrashMLService] Anomaly detected! Score: 0.76
t=2s  ⚠️  [CrashMLService] Anomaly detected! Score: 0.82
t=3s  ⚠️  [CrashMLService] Anomaly detected! Score: 0.79
t=4s  📊 [CrashMLService] Verification complete. Anomaly count: 4/5 (80%)
t=5s  🚨 [CrashMLService] CRASH DETECTED!
      ✅ [ClientHomeScreen] Crash detected
      📍 [AutoSOS] Triggering automatic SOS...
```

**Pass Condition:** SOS alert appears and navigates to map screen with emergency driver info

---

## Console Log Decoding

### Normal Operation
```
🚗 [CrashMLService] Speed: 30.0m/s | Motion: 1.2 | ΔSpeed: 0.1m/s² | Anomaly Score: 0.513
```
✓ Safe driving pattern. Score is low.

### Anomaly Detected (Verification Started)
```
⚠️ [CrashMLService] Anomaly detected! Score: 0.78 (threshold: 0.7)
📊 [CrashMLService] Starting 5-second verification window...
```
⚠️ One anomalous reading. System is watching for more.

### Verification Window Result
```
📊 [CrashMLService] Verification complete. Anomaly count: 4/5 (80%)
```
- **0/5 (0%)** → No crash, normal driving
- **1-2/5 (20-40%)** → Isolated spike, no SOS
- **3-5/5 (60-100%)** → Potential crash, check speed condition

### Crash Triggered
```
🚨 [CrashMLService] CRASH DETECTED! Multiple anomalies + low speed
```
🚨 SOS is being triggered automatically

---

## Configuration Tuning

If you need to adjust sensitivity during testing:

**File:** `app/services/crashMLService.ts`

```typescript
// Lines 56-60
private readonly DEFAULT_CONFIG: CrashDetectionConfig = {
  anomalyScoreThreshold: 0.7,        // ← Lower = more sensitive (0.65)
  verificationDurationSeconds: 5,    // ← Shorter window = faster trigger (3)
  samplingIntervalMs: 1000,          // ← How often to check (ms)
  minSpeedForCrashDetection: 2,      // ← Minimum speed to monitor (m/s)
};
```

**For Testing:**
- **More sensitive:** Change threshold to `0.65`
- **Faster confirmation:** Change duration to `3` seconds
- **More robust:** Change threshold to `0.75`

---

## Troubleshooting

### "Speed too low for crash detection" messages

**Cause:** You're driving slower than 2 m/s (7 km/h)

**Fix:** Drive faster, or lower `minSpeedForCrashDetection` in config

### No anomaly detected during hard braking

**Cause:** Braking wasn't hard enough or motion sensor didn't capture it

**Fix:** Try more aggressive deceleration, or check if phone is secured in car

### SOS triggered but shouldn't have been (False Positive)

1. Lower `minSpeedForCrashDetection` (maybe you weren't going fast enough)
2. Increase `anomalyScoreThreshold` to 0.75
3. Increase `verificationDurationSeconds` to 6-7

### App crashes during Driving Mode

1. Check location permissions are granted
2. Check accelerometer permission is granted
3. View full error in console:
   ```
   ❌ [CrashMLService] Error in detection cycle: [error message]
   ```

---

## Success Checklist

- [ ] Model trains with hardcoded normal driving data (40 samples)
- [ ] Normal driving produces scores 0.45-0.65
- [ ] Crash scenarios produce scores > 0.75+
- [ ] False positives are rare (< 1 per 10 min normal drive)
- [ ] Real crash scenario triggers SOS correctly
- [ ] SOS navigates to driver emergency screen
- [ ] Anomaly score visible in UI during verification

---

## For Developers: Adding Custom Test Data

If you want to add your own crash recordings:

1. **Collect data** during normal/crash drives
2. **Export logs** from console
3. **Add to test suite** in `app/__tests__/crashDetection.test.ts`:

```typescript
const customCrashData: CrashFeature[] = [
  { speed: 35, motion: 5.2, deltaSpeed: -3.1 },  // Your impact point
  { speed: 20, motion: 4.8, deltaSpeed: -2.5 },
  // ... more readings from your crash
];
```

4. **Re-run `runCrashDetectionTests()`** to validate against your data

---

## Next Steps

- After successful manual testing, consider real-world testing with a safety driver
- Collect anonymized crash data to improve the training dataset over time
- Monitor false positive rates in production

**Questions?** Check [AUTO_SOS_IMPLEMENTATION.md](../AUTO_SOS_IMPLEMENTATION.md) for architecture details.
