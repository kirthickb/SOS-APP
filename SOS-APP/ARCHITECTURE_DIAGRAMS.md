# Architecture Diagrams & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ClientHomeScreen                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Automatic SOS Triggers                   │   │
│  │  ┌──────────────┐  ┌─────────────────┐                  │   │
│  │  │ 🎤 Voice SOS │  │ 🚗 Driving Mode │                  │   │
│  │  │ Toggle       │  │ Toggle          │                  │   │
│  │  └──────────────┘  └─────────────────┘                  │   │
│  │        │                   │                             │   │
│  │        └───────────────────┴─────────────────────────────┤   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                              │                         │
└─────────┼──────────────────────────────┼─────────────────────────┘
          │                              │
     ┌────▼──────┐              ┌────────▼─────────┐
     │ useVoiceSOS   │              │ useCrashML    │
     │ Hook          │              │ Hook          │
     └────┬──────┘              └────────┬─────────┘
          │                              │
     ┌────▼──────────────┐       ┌──────▼──────────────┐
     │ voiceSOS Service   │       │ crashMLService      │
     │                    │       │                     │
     │ • Listen for voice │       │ • Monitor GPS speed │
     │ • Detect keywords  │       │ • Read accelerometer│
     │ • Cooldown mgmt    │       │ • Compute motion    │
     └────┬──────────────┘       │ • Get anomaly score │
          │                       │ • Verify crash      │
          │                       └──────┬──────────────┘
          │                              │
          │                        ┌─────▼──────────────┐
          │                        │ isolationForest.ts │
          │                        │                    │
          │                        │ • Fit model        │
          │                        │ • Calculate score  │
          │                        │ • Detect anomalies │
          │                        └────────────────────┘
          │                              │
          └──────────┬───────────────────┘
                     │
                ┌────▼──────────────┐
                │ triggerAutomaticSOS│
                │ (autoSOS Service)  │
                │                    │
                │ • Get location     │
                │ • Call API         │
                │ • Create SOS       │
                └────┬───────────────┘
                     │
                ┌────▼──────────────────┐
                │ apiService.createSOS()│
                │ (Existing API)        │
                │                       │
                │ POST /sos             │
                │ {lat, lng}            │
                └────┬──────────────────┘
                     │
                ┌────▼──────────────────┐
                │   SOS Backend API     │
                │                       │
                │ Create SOS alert      │
                │ Notify nearby drivers │
                └───────────────────────┘
```

---

## Voice SOS Flow

```
User Enables Toggle
        │
        ▼
   useVoiceSOS(enabled=true)
        │
        ▼
voiceSOSService.startListening()
        │
        ├─► Set isListening = true
        ├─► Notify UI: "🔴 Listening..."
        └─► Start recurring recognition loop every 2 seconds
                │
                ▼
        performSpeechRecognition()
                │
                ├─► Get speech input (from real API when integrated)
                ├─► Convert to text
                └─► Call processTranscript(text)
                        │
                        ▼
                Check for keywords:
                • "help"
                • "emergency"
                • "108"
                • "accident"
                        │
            ┌───────────┴───────────┐
            │                       │
    Keyword Found          Keyword Not Found
            │                       │
            ▼                       ▼
    Check Cooldown         Continue Listening
            │
    ┌───────┴───────┐
    │               │
Cooldown Active  Cooldown OK
    │               │
    ▼               ▼
Skip Trigger   Trigger SOS
                    │
                    ▼
            triggerAutomaticSOS("VOICE")
                    │
                    ├─► Request location
                    ├─► Get GPS coords
                    └─► Call API
                            │
                            ▼
                    ✅ SOS Created
                    Alert User
                    30-second cooldown starts
```

---

## ML Crash Detection Flow

```
User Enables Driving Mode
        │
        ▼
   useCrashML(enabled=true)
        │
        ▼
crashMLService.startMonitoring()
        │
        ├─► Initialize Isolation Forest (pre-trained)
        ├─► Set isMonitoring = true
        └─► Start sampling loop every 1 second
                │
                ▼
        performCrashDetectionCycle()
                │
        ┌───────┼───────┐
        │       │       │
        ▼       ▼       ▼
    Get GPS  Get Accel  Compute
    Speed    Data       Features
        │       │           │
        │   (X, Y, Z)    motion=√(x²+y²+z²)
        │                deltaSpeed=Δspeed
        │       │           │
        └───────┴───────────┘
                │
                ▼
        Build CrashFeature
        {speed, motion, deltaSpeed}
                │
    ┌───────────┴──────────────┐
    │                          │
Speed too low (< 2 m/s)    Speed OK
    │                          │
    ▼                          ▼
Skip Analysis        Get Anomaly Score
                      from Isolation Forest
                             │
            ┌────────────────┬┘
            │                │
    Score < 0.7          Score > 0.7
    (Normal)              (Anomaly!)
            │                │
            ▼                ▼
    Continue            Start Verification
    Monitoring          Window (5 seconds)
                             │
                    Collect Anomaly Readings
                             │
        ┌────────────────────┬────────────────────┐
        │                    │                    │
    Verification Window Expires
        │
        ├─► Count anomalies (< 60%?)
        ├─► Check final speed
        │
    ┌───┴─────────────────────────────┐
    │                                 │
Anomaly < 60%              Anomaly ≥ 60% AND
OR                         Final Speed < 3 m/s
Speed still HIGH                   │
    │                              ▼
    ▼                      CRASH DETECTED!
Continue Monitoring             │
                                ▼
                        triggerAutomaticSOS("CRASH_ML")
                                │
                        ├─► Request location
                        ├─► Get GPS coords
                        └─► Call API
                                │
                                ▼
                        ✅ SOS Created
                        Alert User
```

---

## Isolation Forest Algorithm

```
┌────────────────────────────────────────────────────────────────┐
│                    Isolation Forest Training                    │
│                                                                 │
│  Normal Driving Data (40 samples)                              │
│  {speed, motion, deltaSpeed}                                   │
│         │                                                       │
│         ▼                                                       │
│  Build 100 Random Trees                                        │
│         │                                                       │
│    ┌────┴────┬──────┬──────┐                                  │
│    ▼         ▼      ▼      ▼                                  │
│   Tree1    Tree2  Tree3  ...Tree100                           │
│    │         │      │      │                                   │
│    │ Random  │      │      │ Random                            │
│    │ Split   │      │      │ Split                            │
│    │ on      │      │      │ on                               │
│    │ Feature │      │      │ Feature                          │
│    │         │      │      │                                   │
│    ├─►Path   ├─►Path├─►Path├─►Path                            │
│    │ Length  │ Len  │ Len  │ Len                              │
│    │         │      │      │                                   │
│    └─────────┴──────┴──────┘                                   │
│         │                                                       │
│         ▼                                                       │
│  Calculate Average Path Length for Normal Data                │
│  c(n) = 2 * log(n-1) + 0.5772 - 2*(n-1)/n                    │
│                                                                 │
│  Model Ready for Prediction                                    │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    Isolation Forest Scoring                     │
│                                                                 │
│  New Sample: {speed, motion, deltaSpeed}                       │
│         │                                                       │
│         ▼                                                       │
│  Pass through each tree                                        │
│         │                                                       │
│    ┌────┴────┬──────┬──────┐                                  │
│    ▼         ▼      ▼      ▼                                  │
│   Tree1    Tree2  Tree3  ...Tree100                           │
│    │         │      │      │                                  │
│    │ Follow  │      │      │ Follow                           │
│    │ path    │      │      │ path                             │
│    │ Split   │      │      │ Split                            │
│    │ left/   │      │      │ left/                            │
│    │ right   │      │      │ right                            │
│    │         │      │      │                                  │
│    ▼         ▼      ▼      ▼                                  │
│   PL=3      PL=2   PL=5   PL=4  (Path Length)                │
│    │         │      │      │                                  │
│    └─────────┴──────┴──────┘                                  │
│         │                                                       │
│         ▼                                                       │
│  Average Path Length = (3+2+5+4)/4 = 3.5                      │
│         │                                                       │
│         ▼                                                       │
│  Anomaly Score = 2^(-E[h(x)]/c(n))                            │
│  Score = 2^(-3.5/5.2) ≈ 0.68                                 │
│         │                                                       │
│         ▼                                                       │
│  Is Score > 0.7? NO → Normal Data                             │
│  Is Score > 0.7? YES → Potential Crash!                      │
│                                                                 │
│  Result: Anomaly Score = 0.68 (Normal)                        │
└────────────────────────────────────────────────────────────────┘
```

---

## Feature Interaction Diagram

```
┌──────────────────────────────────────────────────┐
│           ClientHomeScreen Component             │
└──────────────────────────────────────────────────┘
        │
        ├─────────────────────┬─────────────────────┐
        │                     │                     │
    Voice SOS           Crash ML               Manual SOS
    (Automatic)        (Automatic)              (User)
        │                     │                     │
        ▼                     ▼                     ▼
   useVoiceSOS()         useCrashML()         sendSOS()
        │                     │                     │
        ├─► Enable when toggle ON
        │   Status: "🔴 Listening..."
        │
        └─► Disable when toggle OFF
            Status: "Say: help..."
        │
        ├─► Enable when toggle ON
        │   Status: "Monitoring (0.523)"
        │
        └─► Disable when toggle OFF
            Status: "ML Crash Detection"
        │
        └─► Always available
            Status: "SOS" (big red button)
        │
        ▼ (All routes lead to) ▼
        │
        triggerAutomaticSOS()     OR      manual sendSOS()
        │                                   │
        ├─ Source: "VOICE"                 └─ Source: manual
        ├─ Source: "CRASH_ML"
        │
        ▼
    apiService.createSOS()
        │
        └─► POST /sos {lat, lng}
                │
                ▼
        Backend SOS Alert
        Notify Drivers
```

---

## State Management

```
┌─────────────────────────────────────────────────────────┐
│          ClientHomeScreen Local State                   │
│                                                         │
│  voiceSOSEnabled: boolean                              │
│  drivingModeEnabled: boolean                           │
│  loading: boolean                                      │
│  locationPermission: boolean                           │
│  latestAnomalyScore: number                            │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│          voiceSOS Service State                         │
│                                                         │
│  isListening: boolean                                  │
│  lastTriggerTime: number (for cooldown)               │
│  config: VoiceSOSConfig                               │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│          crashMLService State                          │
│                                                         │
│  isMonitoring: boolean                                │
│  isVerifying: boolean                                 │
│  lastSpeed: number                                    │
│  lastAccelerometerData: {x, y, z}                    │
│  accumulatedAnomalies: number[]                       │
│  verificationStartTime: number                        │
│  anomalyScoreHistory: number[]                        │
│  isolationForest: IsolationForest (fitted model)     │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│          Global SOS State (SOSContext)                  │
│                                                         │
│  activeSOS: ActiveSOS | null                          │
│  isLoadingActiveSOS: boolean                          │
│  isSosActive: boolean                                 │
│                                                         │
│  (Both Voice and ML use this to create SOS)          │
│  (No separate state - reuses existing context)        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
GPS Data                    Accelerometer Data
    │                               │
    │ Location.getCurrentPositionAsync()
    │ {latitude, longitude, speed}  │
    │                               │
    │                               │ Accelerometer.addListener()
    │                               │ {x, y, z}
    │                               │
    ├───────────────────────────────┤
                    │
            CrashMLService
            Every 1 second
                    │
        ┌───────────┴──────────┐
        │                      │
    Calculate Motion:      Calculate ΔSpeed:
    √(x² + y² + z²)        Δv = speed - lastSpeed
        │                      │
        ├──────────┬───────────┘
                   │
            CrashFeature
            {speed, motion, deltaSpeed}
                   │
                   ▼
        IsolationForest
        .getAnomalyScore()
                   │
            Anomaly Score
            (0.0 to 1.0)
                   │
        ┌──────────┴──────────┐
        │                     │
    < 0.7               > 0.7
    Normal              Anomaly
        │                     │
        │              Store score
        │              in accumulator
        │                     │
        │              After 5 seconds:
        │              Check if ≥60%
        │              anomalies AND
        │              speed < 3 m/s
        │                     │
        │              ┌──────┴──────┐
        │              │             │
        │          False          True
        │              │             │
        │              │     triggerAutomaticSOS()
        │              │             │
        └──────────────┴─────────────┘
```

---

## Console Log Flow

```
User enables Voice SOS toggle
        │
        ▼
🎤 [VoiceSOSService] Initialized with keywords: [...]
🎤 [useVoiceSOS] Starting voice listener
🎤 [VoiceSOSService] Starting voice listener...
🎤 [VoiceSOSService] Listening... (real speech recognition would go here)
        │
        (Every 2 seconds when enabled)
        │
        ▼
🎤 [VoiceSOSService] Recognized transcript: help me
🎤 [VoiceSOSService] Keyword detected: "help"
        │
        (Check cooldown)
        │
        ▼
🎤 [VoiceSOSService] Triggering SOS for keyword: help
🎤 [useVoiceSOS] SOS triggered via: VOICE
        │
        ▼
🚨 [AutoSOS] Triggering SOS from source: VOICE
📍 [AutoSOS] Getting current location...
📡 [AutoSOS] Sending SOS to backend...
✅ [AutoSOS] SOS created successfully! ID: 12345


User enables Driving Mode toggle
        │
        ▼
🚗 [CrashMLService] Initializing Isolation Forest model...
✅ [CrashMLService] Model ready with 40 training samples
🚗 [useCrashML] Starting crash detection monitoring
        │
        (Every 1 second when enabled)
        │
        ▼
🚗 [CrashMLService] Speed: 45.23m/s | Motion: 2.15 | ΔSpeed: 0.12m/s² | Score: 0.523
🚗 [CrashMLService] Speed: 48.15m/s | Motion: 1.95 | ΔSpeed: 0.18m/s² | Score: 0.495
        │
        (Sudden braking occurs)
        │
        ▼
⚠️ [CrashMLService] Anomaly detected! Score: 0.78 (threshold: 0.7)
📊 [CrashMLService] Starting 5-second verification window...
        │
        (Verification period)
        │
        ▼
⚠️ [CrashMLService] Anomaly detected! Score: 0.82 (threshold: 0.7)
⚠️ [CrashMLService] Anomaly detected! Score: 0.79 (threshold: 0.7)
        │
        (5 seconds elapse)
        │
        ▼
📊 [CrashMLService] Verification complete. Anomaly count: 5/5 (100%)
🚨 [CrashMLService] CRASH DETECTED! Multiple anomalies + low speed
🚗 [useCrashML] Crash detected: anomaly=100%, speed=0.45m/s
        │
        ▼
🚨 [AutoSOS] Triggering SOS from source: CRASH_ML
📍 [AutoSOS] Getting current location...
📡 [AutoSOS] Sending SOS to backend...
✅ [AutoSOS] SOS created successfully! ID: 12346
```

---

## Performance Timeline

```
Voice SOS Detection
──────────────────
t=0.0s   User says "Help!"
t=1.0s   Speech recognition completes
t=1.1s   Keyword matched
t=1.2s   Cooldown check OK
t=1.3s   Location request initiated
t=1.5s   Location obtained
t=1.6s   API call made
t=2.0s   SOS created (500ms total latency)
t=2.1s   User notified
t=32.0s  Cooldown expires (30-second window)


ML Crash Detection
──────────────────
t=0.0s   Driving Mode enabled
t=0.5s   Isolation Forest model initialized
t=1.0s   First sensor sample
t=1.1s   Anomaly score computed: 0.523
...
t=10.0s  Sudden crash occurs
t=10.2s  Anomaly score detected: 0.78
t=10.3s  Verification window starts
t=10.4s  Anomaly confirmed: 0.82
...
t=15.4s  Verification window expires (5 seconds)
t=15.5s  Crash criteria met (100% anomalies + low speed)
t=15.6s  SOS trigger initiated
t=15.8s  Location request made
t=16.0s  Location obtained
t=16.1s  API call made
t=16.5s  SOS created (6.5 seconds total detection latency)
t=16.6s  User notified
```

---

## Error Handling Flow

```
Voice SOS Error
───────────────
Speech Recognition Fails
        │
        ▼
onError() callback triggered
        │
        ├─► Log error to console
        ├─► Update UI with error message
        ├─► Display to user
        └─► Retry after delay


ML Crash Detection Error
────────────────────────
GPS Location Fails
        │
        ▼
Catch block triggered
        │
        ├─► Log error to console
        ├─► onError() callback called
        └─► Continue monitoring (skip this cycle)

Accelerometer Unavailable
        │
        ▼
Timeout or error caught
        │
        ├─► Use default {0,0,0}
        ├─► Continue cycle
        └─► Log issue


Auto SOS Error
──────────────
Location Permission Denied
        │
        ▼
Request permission
        │
        ├─► If granted: Continue
        └─► If denied: Return error


API Call Fails
        │
        ▼
Network error or backend error
        │
        ├─► Log full error
        ├─► Return failure result
        └─► Don't retry (let user retry manually)
```

---

These diagrams provide a complete visual representation of:

- System architecture
- Data flows
- Algorithm operations
- State management
- Console logging sequences
- Error handling paths
- Performance timing

Use these to understand the system or explain to team members.

---
