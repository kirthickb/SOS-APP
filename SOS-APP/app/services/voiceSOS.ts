/**
 * ============================================================================
 * VOICE SOS SERVICE
 * ============================================================================
 *
 * Purpose:
 * Provides continuous speech-to-text recognition for automatic SOS triggering.
 * Detects emergency keywords and triggers SOS alerts.
 *
 * Features:
 * - Continuous listening when enabled
 * - Keyword detection (help, emergency, 108, accident)
 * - 30-second cooldown to prevent repeated triggers
 * - Console logging for demo/debug purposes
 *
 * Dependencies:
 * - expo-speech-recognition (must be installed)
 */

import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import type { ExpoSpeechRecognitionOptions } from "expo-speech-recognition";
import type { ExpoSpeechRecognitionPermissionResponse } from "expo-speech-recognition/build/ExpoSpeechRecognitionModule.types";

type VoiceSOSCallback = (triggerType: string) => void;

interface VoiceSOSConfig {
  keywords: string[];
  cooldownSeconds: number;
  onTrigger: VoiceSOSCallback;
  onListeningStateChange?: (isListening: boolean) => void;
  onError?: (error: string) => void;
}

class VoiceSOSService {
  private config: VoiceSOSConfig | null = null;
  private isListening = false;
  private lastTriggerTime = 0;
  private listeningInterval: ReturnType<typeof setInterval> | null = null;
  private isPermissionGranted = false;
  private cancelWindowActive = false;
  private cancelKeywords: string[] = [];
  private cancelResolve: ((cancelled: boolean) => void) | null = null;
  private cancelTimeout: ReturnType<typeof setTimeout> | null = null;
  private listenersRegistered = false;
  private resultSubscription: { remove?: () => void } | null = null;
  private errorSubscription: { remove?: () => void } | null = null;
  private endSubscription: { remove?: () => void } | null = null;

  /**
   * Initialize the Voice SOS service with configuration
   */
  initialize(config: VoiceSOSConfig): void {
    this.config = config;
    console.log(
      "🎤 [VoiceSOSService] Initialized with keywords:",
      config.keywords
    );
  }

  /**
   * Start listening for voice commands
   */
  startListening(): void {
    if (!this.config) {
      console.warn(
        "🎤 [VoiceSOSService] Not initialized. Call initialize() first."
      );
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

    // Initialize speech recognition
    this.initializeSpeechRecognition();
  }

  /**
   * Stop listening for voice commands
   */
  stopListening(): void {
    if (!this.isListening) {
      console.log("🎤 [VoiceSOSService] Not currently listening");
      return;
    }

    this.isListening = false;
    console.log("🎤 [VoiceSOSService] Stopping voice listener...");

    if (this.listeningInterval) {
      clearInterval(this.listeningInterval);
      this.listeningInterval = null;
    }

    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      console.debug(
        "🎤 [VoiceSOSService] Error stopping speech recognition:",
        error
      );
    }

    if (this.config?.onListeningStateChange) {
      this.config.onListeningStateChange(false);
    }
  }

  /**
   * Initialize speech recognition with expo-speech-recognition
   */
  private initializeSpeechRecognition(): void {
    try {
      console.log(
        "🎤 [VoiceSOSService] Initializing expo-speech-recognition..."
      );

      // Request microphone permission
      ExpoSpeechRecognitionModule.requestPermissionsAsync()
        .then((response: ExpoSpeechRecognitionPermissionResponse) => {
          console.log(
            `🎤 [VoiceSOSService] Permission status: ${response.status}`
          );

          if (response.status !== "granted") {
            throw new Error("Permission not granted");
          }

          this.isPermissionGranted = true;
          this.startSpeechRecognition();
        })
        .catch((error: any) => {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error(
            "🎤 [VoiceSOSService] Permission request failed:",
            errorMsg
          );
          this.config?.onError?.(errorMsg);
          this.isListening = false;
          if (this.config?.onListeningStateChange) {
            this.config.onListeningStateChange(false);
          }
        });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        "🎤 [VoiceSOSService] Failed to initialize speech recognition:",
        errorMsg
      );
      this.config?.onError?.(errorMsg);
      this.isListening = false;
      if (this.config?.onListeningStateChange) {
        this.config.onListeningStateChange(false);
      }
    }
  }

  /**
   * Start the actual speech recognition listening
   */
  private startSpeechRecognition(): void {
    try {
      console.log("🎤 [VoiceSOSService] Starting speech recognition...");

      if (!this.listenersRegistered) {
        // Set up event listeners BEFORE starting
        // Listen for results
        this.resultSubscription = ExpoSpeechRecognitionModule.addListener(
          "result",
          (event: any) => {
            const { results } = event;

            if (!results || results.length === 0) {
              return;
            }

            results.forEach((result: any) => {
              const transcript = result.transcript || "";

              if (event.isFinal) {
                console.log(
                  `🎤 [VoiceSOSService] Final transcript: "${transcript}"`
                );
                this.processTranscript(transcript);
              } else {
                console.debug(
                  `🎤 [VoiceSOSService] Interim transcript: "${transcript}"`
                );
              }
            });
          }
        );

        // Listen for errors
        this.errorSubscription = ExpoSpeechRecognitionModule.addListener(
          "error",
          (event: any) => {
            const errorMessage = event.error || "Unknown error";
            console.error(
              "🎤 [VoiceSOSService] Speech recognition error:",
              errorMessage
            );

            if (
              errorMessage === "network" ||
              errorMessage === "no-speech" ||
              errorMessage === "audio-capture"
            ) {
              console.warn(
                "🎤 [VoiceSOSService] Error detected - attempting to restart..."
              );
              // Restart after delay
              setTimeout(() => {
                if (this.isListening) {
                  this.restartSpeechRecognition();
                }
              }, 1000);
            } else {
              this.config?.onError?.(errorMessage);
            }
          }
        );

        // Listen for end event
        this.endSubscription = ExpoSpeechRecognitionModule.addListener(
          "end",
          () => {
            console.log("🎤 [VoiceSOSService] Recognition ended");
            // Restart if still listening
            if (this.isListening) {
              setTimeout(() => {
                this.restartSpeechRecognition();
              }, 500);
            }
          }
        );

        this.listenersRegistered = true;
      }

      // Now start recognition
      const options: ExpoSpeechRecognitionOptions = {
        lang: "en-US",
        continuous: true,
        interimResults: true,
        maxAlternatives: 1,
      };

      ExpoSpeechRecognitionModule.start(options);

      if (this.config?.onListeningStateChange) {
        this.config.onListeningStateChange(true);
      }

      console.log(
        "🎤 [VoiceSOSService] Microphone access granted, listening started..."
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        "🎤 [VoiceSOSService] Failed to start recognition:",
        errorMsg
      );
      this.config?.onError?.(errorMsg);
      this.isListening = false;
      if (this.config?.onListeningStateChange) {
        this.config.onListeningStateChange(false);
      }
    }
  }

  /**
   * Restart speech recognition if it stopped
   */
  private restartSpeechRecognition(): void {
    try {
      if (this.isListening) {
        ExpoSpeechRecognitionModule.stop();
        setTimeout(() => {
          this.startSpeechRecognition();
        }, 500);
      }
    } catch (error) {
      console.debug(
        "🎤 [VoiceSOSService] Error restarting recognition:",
        error
      );
    }
  }

  /**
   * Process recognized transcript and check for keywords
   */
  processTranscript(transcript: string): void {
    if (!this.config || !transcript) return;

    const lowerTranscript = transcript.toLowerCase().trim();

    console.log("🎤 [VoiceSOSService] Recognized transcript:", lowerTranscript);

    if (this.cancelWindowActive) {
      const cancelKeyword = this.cancelKeywords.find((keyword) =>
        lowerTranscript.includes(keyword.toLowerCase())
      );

      if (cancelKeyword) {
        console.log(
          `🎤 [VoiceSOSService] Cancel keyword detected: "${cancelKeyword}"`
        );
        this.finishCancelWindow(true);
      }
      return;
    }

    // Check for keywords
    const detectedKeyword = this.config.keywords.find((keyword) =>
      lowerTranscript.includes(keyword.toLowerCase())
    );

    if (detectedKeyword) {
      console.log(
        `🎤 [VoiceSOSService] Keyword detected: "${detectedKeyword}"`
      );
      this.triggerSOSIfAllowed(detectedKeyword);
    }
  }

  /**
   * Trigger SOS with cooldown check
   */
  private triggerSOSIfAllowed(keyword: string): void {
    const now = Date.now();
    const timeSinceLastTrigger = now - this.lastTriggerTime;
    const cooldownMs = (this.config?.cooldownSeconds || 30) * 1000;

    if (timeSinceLastTrigger < cooldownMs) {
      const remainingSeconds = Math.ceil(
        (cooldownMs - timeSinceLastTrigger) / 1000
      );
      console.log(
        `⏱️ [VoiceSOSService] Cooldown active. Wait ${remainingSeconds}s before next trigger`
      );
      return;
    }

    this.lastTriggerTime = now;
    console.log(`🎤 [VoiceSOSService] Triggering SOS for keyword: ${keyword}`);

    if (this.config?.onTrigger) {
      this.config.onTrigger("VOICE");
    }
  }

  /**
   * Start a temporary cancellation window to listen for cancel keywords
   */
  startCancelWindow(
    cancelKeywords: string[],
    timeoutMs: number
  ): Promise<boolean> {
    if (!this.isListening) {
      return Promise.resolve(false);
    }

    if (this.cancelTimeout) {
      clearTimeout(this.cancelTimeout);
      this.cancelTimeout = null;
    }

    this.cancelWindowActive = true;
    this.cancelKeywords = cancelKeywords;

    return new Promise((resolve) => {
      this.cancelResolve = resolve;
      this.cancelTimeout = setTimeout(() => {
        this.finishCancelWindow(false);
      }, timeoutMs);
    });
  }

  private finishCancelWindow(cancelled: boolean): void {
    if (this.cancelTimeout) {
      clearTimeout(this.cancelTimeout);
      this.cancelTimeout = null;
    }

    this.cancelWindowActive = false;
    this.cancelKeywords = [];

    if (this.cancelResolve) {
      this.cancelResolve(cancelled);
      this.cancelResolve = null;
    }
  }

  /**
   * Get current listening state
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Reset cooldown (for testing)
   */
  resetCooldown(): void {
    this.lastTriggerTime = 0;
    console.log("🎤 [VoiceSOSService] Cooldown reset");
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopListening();
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch (error) {
      console.debug("🎤 [VoiceSOSService] Error destroying:", error);
    }
    if (this.resultSubscription?.remove) {
      this.resultSubscription.remove();
    }
    if (this.errorSubscription?.remove) {
      this.errorSubscription.remove();
    }
    if (this.endSubscription?.remove) {
      this.endSubscription.remove();
    }
    this.resultSubscription = null;
    this.errorSubscription = null;
    this.endSubscription = null;
    this.listenersRegistered = false;
    if (this.cancelTimeout) {
      clearTimeout(this.cancelTimeout);
      this.cancelTimeout = null;
    }
    this.cancelWindowActive = false;
    this.cancelKeywords = [];
    this.cancelResolve = null;
    this.config = null;
    console.log("🎤 [VoiceSOSService] Destroyed");
  }
}

// Export singleton instance
const voiceSOSService = new VoiceSOSService();

export default voiceSOSService;
export type { VoiceSOSConfig };
