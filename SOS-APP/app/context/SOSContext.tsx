import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiService from "../services/api";
import socketService from "../services/socket";
import { SOSResponse } from "../types";

/**
 * ============================================================================
 * SOS CONTEXT - Global Application State for Emergency Requests
 * ============================================================================
 *
 * Purpose:
 * Manages the lifecycle of SOS (emergency) requests as PERSISTENT GLOBAL STATE.
 * Ensures SOS state is NOT tied to screen navigation or component re-renders.
 *
 * Key Features:
 * 1. PERSISTENT Storage: SOS state persists in AsyncStorage across app backgrounding/restart
 * 2. GLOBAL Access: Any screen can access active SOS status via useSOSContext()
 * 3. DRIVER Details: Full driver information stored when SOS is accepted
 * 4. EXPLICIT CANCEL: User can cancel SOS at any time, clearing both SOS and driver state
 * 5. WEBSOCKET Sync: Real-time updates from backend via WebSocket subscriptions
 * 6. STATE Restoration: On app restart, checks backend for active SOS and restores state
 *
 * Storage Keys:
 * - "activeSOS": Full ActiveSOS object (JSON) with SOS and driver details
 * - "sosStatus": Current status (PENDING, ACCEPTED, ARRIVED, COMPLETED, CANCELLED)
 * - "driverInfo": Accepted driver details (name, phone, vehicle, ID)
 * - "patientPickedUpTime": Timestamp when driver picked up patient
 *
 * State Lifecycle:
 * 1. User triggers SOS (PENDING status)
 * 2. Driver accepts SOS (ACCEPTED status) - driver details stored globally
 * 3. Driver arrives and picks up patient (ARRIVED status)
 * 4. Driver completes at hospital (COMPLETED status) - state auto-cleared
 * 5. OR User cancels at any time (CANCELLED status) - state explicitly cleared
 */

// Storage keys for persistent state
const ACTIVE_SOS_KEY = "activeSOS";
const SOS_STATUS_KEY = "sosStatus";
const DRIVER_INFO_KEY = "driverInfo";
const PATIENT_PICKUP_TIME_KEY = "patientPickedUpTime";

/**
 * Extended SOS type that includes local state metadata
 */
interface ActiveSOS extends SOSResponse {
  acceptedDriverId?: number;
  acceptedDriverPhone?: string;
  acceptedDriverName?: string;
  acceptedDriverVehicle?: string;
  acceptedAtTime?: string;
  createdAtTime?: string;
  arrivedAtTime?: string;
}

/**
 * SOS Context API Type Definition
 */
interface SOSContextType {
  // State
  activeSOS: ActiveSOS | null;
  isLoadingActiveSOS: boolean;
  isSosActive: boolean; // Convenience: true if activeSOS is not null and status is active

  // Methods
  acceptSOS: (
    sosId: number,
    driverId: number,
    driverPhone: string,
    driverName: string,
    vehicle: string
  ) => Promise<void>;
  markPatientPickedUp: () => Promise<void>;
  markSOSCompleted: () => Promise<void>;
  cancelSOS: () => Promise<void>; // User-initiated cancellation
  updateSOSFromWebsocket: (sosUpdate: SOSResponse) => void; // Real-time backend updates
}

// Create context
const SOSContext = createContext<SOSContextType | undefined>(undefined);

/**
 * SOS Provider Component
 * Wrap your app with this to enable global SOS state management
 */
export const SOSProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [activeSOS, setActiveSOS] = useState<ActiveSOS | null>(null);
  const [isLoadingActiveSOS, setIsLoadingActiveSOS] = useState(true);

  // Convenience flag for checking if SOS is active
  const isSosActive =
    activeSOS !== null &&
    ["PENDING", "ACCEPTED", "ARRIVED"].includes(activeSOS.status);

  /**
   * Initialize: Restore SOS state from storage on app start
   */
  useEffect(() => {
    restoreSOSStateFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Subscribe to WebSocket updates for active SOS
   */
  useEffect(() => {
    if (!activeSOS) return;

    console.log(
      "📡 [SOSContext] Subscribing to WebSocket updates for SOS:",
      activeSOS.id
    );

    const unsubscribe = socketService.subscribeToSOS((sos: SOSResponse) => {
      // Only update if this is our active SOS
      if (sos.id === activeSOS.id) {
        console.log(
          "📡 [SOSContext] WebSocket update for active SOS - Status:",
          sos.status
        );
        updateSOSFromWebsocket(sos);
      }
    });

    return () => {
      console.log("🔌 [SOSContext] Unsubscribing from WebSocket");
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSOS?.id]);

  /**
   * Internal method to completely clear SOS and driver state
   */
  const clearActiveSOS = useCallback(async () => {
    try {
      console.log("🗑️ [SOSContext] Clearing active SOS state");

      setActiveSOS(null);

      // Remove all SOS-related data from AsyncStorage
      await AsyncStorage.multiRemove([
        ACTIVE_SOS_KEY,
        SOS_STATUS_KEY,
        DRIVER_INFO_KEY,
        PATIENT_PICKUP_TIME_KEY,
      ]);

      console.log("✅ [SOSContext] Active SOS state cleared from storage");
    } catch (error) {
      console.error("❌ [SOSContext] Error clearing SOS state:", error);
    }
  }, []);

  /**
   * Restore SOS state from persistent storage (on app restart/resume)
   * Only restores active SOS if status is ACCEPTED, ARRIVED (not PENDING, COMPLETED, CANCELLED)
   */
  const restoreSOSStateFromStorage = useCallback(async () => {
    try {
      setIsLoadingActiveSOS(true);

      const sosDataStr = await AsyncStorage.getItem(ACTIVE_SOS_KEY);
      const sosStatus = await AsyncStorage.getItem(SOS_STATUS_KEY);

      if (!sosDataStr || !sosStatus) {
        console.log("📭 [SOSContext] No active SOS found in storage");
        setActiveSOS(null);
        setIsLoadingActiveSOS(false);
        return;
      }

      const sosData: ActiveSOS = JSON.parse(sosDataStr);

      // Only restore if status is ACCEPTED or ARRIVED (active states)
      if (!["ACCEPTED", "ARRIVED"].includes(sosStatus)) {
        console.log(
          "🗑️ [SOSContext] Clearing completed/cancelled SOS from storage - Status:",
          sosStatus
        );
        await clearActiveSOS();
        return;
      }

      // Fetch latest SOS data from backend to get current state
      try {
        console.log("🔄 [SOSContext] Fetching latest SOS from backend");
        const latestSos = await apiService.getSOS(sosData.id);

        // Update with backend data but preserve local driver details
        const restoredSos: ActiveSOS = {
          ...latestSos,
          acceptedDriverId: sosData.acceptedDriverId,
          acceptedDriverPhone: sosData.acceptedDriverPhone,
          acceptedDriverName: sosData.acceptedDriverName,
          acceptedDriverVehicle: sosData.acceptedDriverVehicle,
          acceptedAtTime: sosData.acceptedAtTime,
          createdAtTime: sosData.createdAtTime,
          arrivedAtTime: sosData.arrivedAtTime,
        };

        setActiveSOS(restoredSos);
        console.log(
          "✅ [SOSContext] SOS restored from storage - ID:",
          sosData.id
        );
      } catch (error) {
        console.error(
          "❌ [SOSContext] Failed to fetch active SOS from backend:",
          error
        );
        // If SOS not found on backend, clear local state
        await clearActiveSOS();
      }
    } catch (error) {
      console.error("❌ [SOSContext] Error restoring SOS state:", error);
      setActiveSOS(null);
    } finally {
      setIsLoadingActiveSOS(false);
    }
  }, [clearActiveSOS]);

  /**
   * Accept a SOS request (called by driver)
   * Stores full driver and SOS details to global state for access across all screens
   */
  const acceptSOS = useCallback(
    async (
      sosId: number,
      driverId: number,
      driverPhone: string,
      driverName: string,
      vehicle: string
    ) => {
      try {
        console.log("🚗 [SOSContext] Driver accepting SOS:", sosId);

        // Call backend to accept SOS
        const response = await apiService.acceptSOS(sosId);

        const sosData: ActiveSOS = {
          ...response,
          acceptedDriverId: driverId,
          acceptedDriverPhone: driverPhone,
          acceptedDriverName: driverName,
          acceptedDriverVehicle: vehicle,
          acceptedAtTime: new Date().toISOString(),
        };

        // Store in global state
        setActiveSOS(sosData);

        // Persist to AsyncStorage for app restart/background scenarios
        await AsyncStorage.multiSet([
          [ACTIVE_SOS_KEY, JSON.stringify(sosData)],
          [SOS_STATUS_KEY, "ACCEPTED"],
          [
            DRIVER_INFO_KEY,
            JSON.stringify({
              id: driverId,
              phone: driverPhone,
              name: driverName,
              vehicle: vehicle,
            }),
          ],
        ]);

        console.log("✅ [SOSContext] SOS accepted - Driver:", driverName);
      } catch (error) {
        console.error("❌ [SOSContext] Error accepting SOS:", error);
        throw error;
      }
    },
    []
  );

  /**
   * Mark patient as picked up (called when driver arrives and picks up patient)
   */
  const markPatientPickedUp = useCallback(async () => {
    if (!activeSOS) return;

    try {
      console.log(
        "🏥 [SOSContext] Marking patient as picked up for SOS:",
        activeSOS.id
      );

      await apiService.markPatientArrived(activeSOS.id);

      const arrivedTime = new Date().toISOString();
      const updatedSOS: ActiveSOS = {
        ...activeSOS,
        status: "ARRIVED" as any,
        arrivedAtTime: arrivedTime,
      };

      setActiveSOS(updatedSOS);

      // Update AsyncStorage
      await AsyncStorage.multiSet([
        [ACTIVE_SOS_KEY, JSON.stringify(updatedSOS)],
        [SOS_STATUS_KEY, "ARRIVED"],
        [PATIENT_PICKUP_TIME_KEY, arrivedTime],
      ]);

      console.log("✅ [SOSContext] Patient marked as picked up");
    } catch (error) {
      console.error(
        "❌ [SOSContext] Error marking patient as picked up:",
        error
      );
      throw error;
    }
  }, [activeSOS]);

  /**
   * Mark SOS as completed (called when driver reaches hospital)
   */
  const markSOSCompleted = useCallback(async () => {
    if (!activeSOS) return;

    try {
      console.log("✨ [SOSContext] Marking SOS as completed:", activeSOS.id);

      await apiService.completeSOS(activeSOS.id);

      // Clear state after completion
      await clearActiveSOS();

      console.log("✅ [SOSContext] SOS completed and cleared");
    } catch (error) {
      console.error("❌ [SOSContext] Error marking SOS as completed:", error);
      throw error;
    }
  }, [activeSOS, clearActiveSOS]);

  /**
   * Cancel SOS request - called when user cancels emergency
   * Explicitly clears both SOS and driver state
   * This is different from auto-clear on completion
   * Notifies backend so drivers don't see cancelled request
   */
  const cancelSOS = useCallback(async () => {
    if (!activeSOS) {
      console.log("ℹ️ [SOSContext] No active SOS to cancel");
      return;
    }

    try {
      console.log("❌ [SOSContext] User cancelling SOS:", activeSOS.id);

      // Notify backend of cancellation
      try {
        await apiService.cancelSOS(activeSOS.id);
        console.log("✅ [SOSContext] Backend notified of cancellation");
      } catch (error) {
        console.error(
          "⚠️ [SOSContext] Error notifying backend of cancellation:",
          error
        );
        // Continue with local cleanup even if backend fails
      }

      // Clear all SOS and driver state
      await clearActiveSOS();

      console.log(
        "✅ [SOSContext] SOS cancelled by user and removed from drivers"
      );
    } catch (error) {
      console.error("❌ [SOSContext] Error cancelling SOS:", error);
      throw error;
    }
  }, [activeSOS, clearActiveSOS]);

  /**
   * Update SOS state from WebSocket notification
   * Called when backend sends real-time updates
   */
  const updateSOSFromWebsocket = useCallback(
    (sosUpdate: SOSResponse) => {
      if (!activeSOS || sosUpdate.id !== activeSOS.id) {
        console.warn(
          "⚠️ [SOSContext] Ignoring WebSocket update for different SOS"
        );
        return;
      }

      console.log(
        "📡 [SOSContext] Updating from WebSocket - Status:",
        sosUpdate.status
      );

      // Merge with existing activeSOS to preserve driver details
      const updatedSOS: ActiveSOS = {
        ...activeSOS,
        ...sosUpdate,
      };

      setActiveSOS(updatedSOS);

      // Update AsyncStorage
      AsyncStorage.multiSet([
        [ACTIVE_SOS_KEY, JSON.stringify(updatedSOS)],
        [SOS_STATUS_KEY, sosUpdate.status],
      ]);

      // Clear if completed or cancelled
      if (
        sosUpdate.status === "COMPLETED" ||
        sosUpdate.status === "CANCELLED"
      ) {
        console.log(
          "🏁 [SOSContext] SOS finished via WebSocket, clearing after delay"
        );
        setTimeout(() => clearActiveSOS(), 2000);
      }
    },
    [activeSOS, clearActiveSOS]
  );

  // Removed the separate clearActiveSOS function as it's already defined above

  const value: SOSContextType = {
    activeSOS,
    isLoadingActiveSOS,
    isSosActive,
    acceptSOS,
    markPatientPickedUp,
    markSOSCompleted,
    cancelSOS,
    updateSOSFromWebsocket,
  };

  return <SOSContext.Provider value={value}>{children}</SOSContext.Provider>;
};

/**
 * Hook to access SOS context
 * Use in any component: const { activeSOS, cancelSOS } = useSOSContext()
 */
export const useSOSContext = () => {
  const context = useContext(SOSContext);
  if (!context) {
    throw new Error("useSOSContext must be used within SOSProvider");
  }
  return context;
};
