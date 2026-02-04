/**
 * ============================================================================
 * USE VOICE SOS HOOK
 * ============================================================================
 *
 * Purpose:
 * React hook to integrate Voice SOS service into components.
 * Manages initialization, cleanup, and state synchronization.
 *
 * Usage:
 * const { isListening, error } = useVoiceSOS(enabled, onTrigger);
 */

import { useEffect, useState, useRef } from "react";
import voiceSOSService from "../services/voiceSOS";

interface UseVoiceSOSOptions {
  keywords?: string[];
  cooldownSeconds?: number;
  onError?: (error: string) => void;
}

interface UseVoiceSOSResult {
  isListening: boolean;
  error: string | null;
  resetCooldown: () => void;
}

/**
 * Hook to manage Voice SOS listener
 * @param enabled - Whether to enable voice SOS
 * @param onTrigger - Callback when SOS is triggered
 * @param options - Configuration options
 */
export const useVoiceSOS = (
  enabled: boolean,
  onTrigger: () => void,
  options: UseVoiceSOSOptions = {}
): UseVoiceSOSResult => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const onTriggerRef = useRef(onTrigger);

  // Update ref when callback changes
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  const keywords = options.keywords || ["help", "emergency", "108", "accident"];
  const cooldownSeconds = options.cooldownSeconds || 30;

  // Initialize service once on mount
  useEffect(() => {
    if (!initializedRef.current) {
      console.log("🎤 [useVoiceSOS] Initializing voice SOS service");
      voiceSOSService.initialize({
        keywords,
        cooldownSeconds,
        onTrigger: (triggerType) => {
          console.log("🎤 [useVoiceSOS] SOS triggered via:", triggerType);
          onTriggerRef.current();
        },
        onListeningStateChange: setIsListening,
        onError: (err) => {
          console.error("🎤 [useVoiceSOS] Error:", err);
          setError(err);
        },
      });
      initializedRef.current = true;
      console.log("🎤 [useVoiceSOS] Service initialized successfully");
    }

    return () => {
      // Cleanup on unmount only
      console.log("🎤 [useVoiceSOS] Cleaning up");
      voiceSOSService.stopListening();
    };
  }, []); // Empty dependency array - initialize once

  // Handle enable/disable separately
  useEffect(() => {
    if (enabled) {
      console.log("🎤 [useVoiceSOS] Starting voice listener");
      voiceSOSService.startListening();
    } else {
      console.log("🎤 [useVoiceSOS] Stopping voice listener");
      voiceSOSService.stopListening();
    }
  }, [enabled]);

  return {
    isListening,
    error,
    resetCooldown: () => voiceSOSService.resetCooldown(),
  };
};
