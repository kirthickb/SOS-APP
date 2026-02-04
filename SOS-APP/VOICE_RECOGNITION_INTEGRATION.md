# Voice Recognition Integration Guide

This guide explains how to integrate real speech-to-text recognition into the Voice SOS feature.

## Current State

The `voiceSOS.ts` service has a **placeholder** for the actual speech recognition implementation. This was intentional to provide a clear integration point.

### Current Placeholder Code

In `app/services/voiceSOS.ts`, the `performSpeechRecognition()` method:

```typescript
private performSpeechRecognition(): void {
  if (!this.config) return;

  try {
    // PLACEHOLDER: In production, integrate with:
    // - expo-speech-recognition
    // - react-native-speech-recognition
    // - Or native module for speech-to-text

    const simulatedTranscripts = [
      // "help me",
      // "emergency",
      // "accident",
      // "normal conversation",
    ];

    // In production, replace this with actual speech recognition API
    this.processTranscript("");

    console.debug(
      "🎤 [VoiceSOSService] Listening... (real speech recognition would go here)"
    );
  } catch (error) {
    // ... error handling
  }
}
```

---

## Option 1: Using `expo-speech-recognition`

### Installation

```bash
npm install expo-speech-recognition
# or
yarn add expo-speech-recognition
```

### Update voiceSOS.ts

Replace the `performSpeechRecognition()` method:

```typescript
import { useSpeechRecognition } from 'expo-speech-recognition';

private speechRecognitionSubscription: any = null;

private performSpeechRecognition(): void {
  if (!this.config) return;

  try {
    // Start continuous listening
    Speech.startListening({
      language: 'en-US',
      continuous: false,
      interimResults: true,
    });

    // Handle speech recognition updates
    const onSpeechResults = (event: any) => {
      const transcript = event.value?.[0] || '';

      console.log(
        "🎤 [VoiceSOSService] Recognized transcript:",
        transcript
      );

      if (transcript) {
        this.processTranscript(transcript);
      }
    };

    const onSpeechError = (error: any) => {
      console.error("🎤 [VoiceSOSService] Speech recognition error:", error);
      this.config?.onError?.(error);
    };

    // Subscribe to events
    Speech.onSpeechResults(onSpeechResults);
    Speech.onSpeechError(onSpeechError);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("🎤 [VoiceSOSService] Error in recognition:", errorMsg);
    this.config?.onError?.(errorMsg);
  }
}

destroy(): void {
  this.stopListening();
  if (this.speechRecognitionSubscription) {
    this.speechRecognitionSubscription.remove();
  }
  this.config = null;
}
```

### Update startListening()

```typescript
startListening(): void {
  if (!this.config) {
    console.warn("🎤 [VoiceSOSService] Not initialized");
    return;
  }

  if (this.isListening) {
    console.log("🎤 [VoiceSOSService] Already listening");
    return;
  }

  this.isListening = true;
  console.log("🎤 [VoiceSOSService] Starting voice listener...");

  if (this.config.onListeningStateChange) {
    this.config.onListeningStateChange(true);
  }

  // Use real Speech Recognition API
  try {
    Speech.start();
  } catch (error) {
    console.error("🎤 [VoiceSOSService] Failed to start listening:", error);
    this.config?.onError?.(String(error));
  }
}
```

### Update stopListening()

```typescript
stopListening(): void {
  if (!this.isListening) {
    console.log("🎤 [VoiceSOSService] Not currently listening");
    return;
  }

  this.isListening = false;
  console.log("🎤 [VoiceSOSService] Stopping voice listener...");

  try {
    Speech.stop();
  } catch (error) {
    console.error("🎤 [VoiceSOSService] Error stopping:", error);
  }

  if (this.config?.onListeningStateChange) {
    this.config.onListeningStateChange(false);
  }
}
```

---

## Option 2: Using `react-native-speech-recognition`

### Installation

```bash
npm install react-native-speech-recognition
# Link native modules
react-native link react-native-speech-recognition
```

### Update voiceSOS.ts

```typescript
import RNSpeechRecognition from 'react-native-speech-recognition';

private performSpeechRecognition(): void {
  if (!this.config) return;

  try {
    RNSpeechRecognition.startRecognition(
      'en-US',
      60000, // 60 second timeout
      () => {
        // Recognition started callback
        console.log("🎤 [VoiceSOSService] Recognition started");
      },
      (error: any) => {
        // Error callback
        console.error("🎤 [VoiceSOSService] Recognition error:", error);
        this.config?.onError?.(String(error));
      },
      (results: string[]) => {
        // Results callback
        if (results && results.length > 0) {
          const transcript = results[0];
          console.log(
            "🎤 [VoiceSOSService] Recognized transcript:",
            transcript
          );

          if (transcript) {
            this.processTranscript(transcript);
          }
        }
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("🎤 [VoiceSOSService] Error in recognition:", errorMsg);
    this.config?.onError?.(errorMsg);
  }
}

stopListening(): void {
  if (!this.isListening) {
    console.log("🎤 [VoiceSOSService] Not currently listening");
    return;
  }

  this.isListening = false;
  console.log("🎤 [VoiceSOSService] Stopping voice listener...");

  try {
    RNSpeechRecognition.stopRecognition();
  } catch (error) {
    console.error("🎤 [VoiceSOSService] Error stopping:", error);
  }

  if (this.config?.onListeningStateChange) {
    this.config.onListeningStateChange(false);
  }
}
```

---

## Option 3: Using Web Speech API (for Web/Expo Web)

For Expo Web or cross-platform support:

```typescript
private speechRecognition: any = null;

private performSpeechRecognition(): void {
  if (!this.config) return;

  try {
    // Web Speech API (browser)
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error("Speech Recognition API not supported");
    }

    this.speechRecognition = new SpeechRecognition();
    this.speechRecognition.continuous = true;
    this.speechRecognition.interimResults = true;
    this.speechRecognition.language = 'en-US';

    this.speechRecognition.onstart = () => {
      console.log("🎤 [VoiceSOSService] Listening started...");
    };

    this.speechRecognition.onresult = (event: any) => {
      let transcript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      console.log(
        "🎤 [VoiceSOSService] Recognized transcript:",
        transcript
      );

      if (transcript) {
        this.processTranscript(transcript);
      }
    };

    this.speechRecognition.onerror = (event: any) => {
      console.error("🎤 [VoiceSOSService] Recognition error:", event.error);
      this.config?.onError?.(event.error);
    };

    this.speechRecognition.start();

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("🎤 [VoiceSOSService] Error:", errorMsg);
    this.config?.onError?.(errorMsg);
  }
}

stopListening(): void {
  if (!this.isListening) {
    console.log("🎤 [VoiceSOSService] Not currently listening");
    return;
  }

  this.isListening = false;

  if (this.speechRecognition) {
    this.speechRecognition.stop();
  }

  if (this.config?.onListeningStateChange) {
    this.config.onListeningStateChange(false);
  }
}
```

---

## Comparison

| Feature            | expo-speech-recognition | react-native-speech-recognition | Web Speech API   |
| ------------------ | ----------------------- | ------------------------------- | ---------------- |
| iOS Support        | ✅                      | ✅                              | ❌ (native only) |
| Android Support    | ✅                      | ✅                              | ❌ (native only) |
| Web Support        | ❌                      | ❌                              | ✅               |
| Active Maintenance | ✅                      | ⚠️                              | N/A (native)     |
| Ease of Use        | ⭐⭐⭐⭐⭐              | ⭐⭐⭐⭐                        | ⭐⭐⭐           |
| Recommended        | ✅                      | ✅                              | ✅ (for web)     |

### Recommendation

**Use `expo-speech-recognition`** - It's the most actively maintained and easiest to integrate with Expo.

---

## Permissions Required

Before implementing speech recognition, add these permissions to your `app.json`:

```json
{
  "plugins": [
    [
      "expo-speech-recognition",
      {
        "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone to recognize voice commands."
      }
    ]
  ],
  "android": {
    "permissions": ["android.permission.RECORD_AUDIO"]
  },
  "ios": {
    "infoPlist": {
      "NSMicrophoneUsageDescription": "Allow $(PRODUCT_NAME) to access your microphone to recognize voice commands."
    }
  }
}
```

---

## Testing Checklist After Integration

- [ ] Install speech recognition library
- [ ] Update `performSpeechRecognition()` method
- [ ] Update `startListening()` method
- [ ] Update `stopListening()` method
- [ ] Add microphone permissions to `app.json`
- [ ] Test on iOS simulator/device
- [ ] Test on Android emulator/device
- [ ] Verify keywords detected correctly
- [ ] Check console logs show transcript
- [ ] Verify SOS triggers on keyword
- [ ] Test with different accents/speeds
- [ ] Test with background noise
- [ ] Verify 30-second cooldown works
- [ ] Check performance impact

---

## Debugging Tips

### Enable Verbose Logging

Add this to `performSpeechRecognition()`:

```typescript
const recognitionDuration = (results: string[], isFinal: boolean) => {
  console.log(
    `🎤 [VoiceSOSService] Partial: "${results[0]}" (Final: ${isFinal})`
  );
};
```

### Test Keyword Matching

Add a test mode in the hook:

```typescript
// In app/hooks/useVoiceSOS.ts
const testTranscript = (text: string) => {
  voiceSOSService.processTranscript(text);
};

// Call like: testTranscript("help me");
```

### Monitor Confidence Score

If the API provides confidence scores:

```typescript
const results = event.results;
results.forEach((result, index) => {
  console.log(
    `Result ${index}: "${result[0].transcript}" (${(
      result[0].confidence * 100
    ).toFixed(0)}% confident)`
  );
});
```

---

## Common Issues & Solutions

### Issue: "Permission Denied"

**Solution:** Ensure microphone permission is granted in app settings

### Issue: "No results returned"

**Solution:** Check language code is correct (should be 'en-US')

### Issue: "High false positive rate"

**Solution:**

- Adjust keyword list
- Add confidence score threshold
- Implement phrase-level matching instead of individual words

### Issue: "Service crashes after 60 seconds"

**Solution:** Implement automatic restart of recognition in `setInterval`

### Issue: "Battery drains quickly"

**Solution:**

- Disable when app is in background
- Use `AppState` to detect background/foreground
- Stop listening when screen is locked

---

## Production Best Practices

1. **Always check permission status:**

   ```typescript
   const { status } = await Permissions.askAsync(Permissions.MICROPHONE);
   if (status !== "granted") {
     this.config?.onError?.("Microphone permission denied");
     return;
   }
   ```

2. **Implement graceful fallback:**

   ```typescript
   if (!SpeechRecognition) {
     console.warn("Speech recognition not available, disabling feature");
     return;
   }
   ```

3. **Handle lifecycle properly:**

   ```typescript
   useEffect(() => {
     const subscription = AppState.addEventListener(
       "change",
       handleAppStateChange
     );
     return () => subscription.remove();
   }, []);
   ```

4. **Add user feedback:**

   ```typescript
   // Show visual feedback during listening
   onListeningStateChange?.(isListening);
   ```

5. **Implement error recovery:**
   ```typescript
   if (error) {
     setTimeout(() => {
       this.performSpeechRecognition(); // Retry after delay
     }, 2000);
   }
   ```

---

## Next Steps

1. Choose a speech recognition library (recommend: `expo-speech-recognition`)
2. Install the library
3. Update `voiceSOS.ts` using one of the options above
4. Add microphone permissions to `app.json`
5. Test thoroughly
6. Deploy to production

---

**Integration Status:** Ready for implementation  
**Estimated Time:** 30-60 minutes  
**Difficulty:** Low to Medium

---
