// app/context/SOSContext.tsx
import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiService from "../services/api";
import socketService from "../services/socket";

interface ActiveSOS {
  id: number;
  clientName: string;
  clientPhone: string;
  latitude: number;
  longitude: number;
  status: "PENDING" | "ACCEPTED" | "ARRIVED" | "COMPLETED" | "CANCELLED";
  acceptedDriverName?: string;
  driverLatitude?: number;
  driverLongitude?: number;
}

interface SOSContextType {
  activeSOS: ActiveSOS | null;
  isLoadingActiveSOS: boolean;
  acceptedSOS: number | null; // sosId of currently accepted SOS
  acceptSOS: (sosId: number) => Promise<void>;
  markPatientPickedUp: (sosId: number) => Promise<void>;
  markSOSCompleted: (sosId: number) => Promise<void>;
  clearActiveSOS: () => Promise<void>;
  checkForActiveSOS: () => Promise<void>;
}

const SOSContext = createContext<SOSContextType | undefined>(undefined);

interface SOSProviderProps {
  children: ReactNode;
}

export const SOSProvider: React.FC<SOSProviderProps> = ({ children }) => {
  const [activeSOS, setActiveSOS] = useState<ActiveSOS | null>(null);
  const [acceptedSOS, setAcceptedSOS] = useState<number | null>(null);
  const [isLoadingActiveSOS, setIsLoadingActiveSOS] = useState(true);

  // Check for active SOS on app start and resume
  useEffect(() => {
    checkForActiveSOS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to WebSocket updates to keep activeSOS in sync with backend
  useEffect(() => {
    if (!acceptedSOS) return; // Only subscribe if there's an active SOS

    console.log(
      "📡 [SOSContext] Subscribing to WebSocket updates for SOS:",
      acceptedSOS
    );

    const unsubscribe = socketService.subscribeToSOS((sos) => {
      // Only update if this is our active SOS
      if (sos.id === acceptedSOS) {
        console.log(
          "📡 [SOSContext] WebSocket update for active SOS:",
          sos.status
        );

        // Update activeSOS from WebSocket (backend truth)
        setActiveSOS(sos as any);

        // Update AsyncStorage to persist status
        AsyncStorage.setItem("sosStatus", sos.status);

        // Clear if completed or cancelled
        if (sos.status === "COMPLETED" || sos.status === "CANCELLED") {
          console.log("🏁 [SOSContext] SOS finished, will clear after delay");
          setTimeout(() => clearActiveSOS(), 2000);
        }
      }
    });

    return () => {
      console.log("🔌 [SOSContext] Unsubscribing from WebSocket");
      unsubscribe();
    };
  }, [acceptedSOS]);

  const checkForActiveSOS = async () => {
    try {
      setIsLoadingActiveSOS(true);

      // Check if there's a saved active SOS ID
      const savedSOSId = await AsyncStorage.getItem("activeSOS");
      const savedSOSStatus = await AsyncStorage.getItem("sosStatus");

      if (savedSOSId && savedSOSStatus) {
        const sosId = parseInt(savedSOSId);

        // Only restore if status is ACCEPTED or ARRIVED
        if (["ACCEPTED", "ARRIVED"].includes(savedSOSStatus)) {
          setAcceptedSOS(sosId);

          // Fetch latest SOS data from backend
          try {
            const response = await apiService.getSOS(sosId);
            setActiveSOS(response as any);
          } catch (error) {
            console.error("Failed to fetch active SOS:", error);
            // Clear if SOS no longer exists
            await clearActiveSOS();
          }
        } else {
          // Clear if status is COMPLETED or CANCELLED
          await clearActiveSOS();
        }
      }
    } catch (error) {
      console.error("Error checking for active SOS:", error);
    } finally {
      setIsLoadingActiveSOS(false);
    }
  };

  const acceptSOS = async (sosId: number) => {
    try {
      // Call backend to accept
      const response = await apiService.acceptSOS(sosId);

      // Save to persistent storage
      await AsyncStorage.setItem("activeSOS", sosId.toString());
      await AsyncStorage.setItem("sosStatus", "ACCEPTED");

      setAcceptedSOS(sosId);
      setActiveSOS(response as any);
    } catch (error) {
      console.error("Error accepting SOS:", error);
      throw error;
    }
  };

  // Mark patient as picked up (status change from ACCEPTED to ARRIVED)
  const markPatientPickedUp = async (sosId: number) => {
    try {
      console.log("📍 [SOSContext] Marking patient arrived for SOS:", sosId);
      console.log("📍 [SOSContext] Current activeSOS state:", activeSOS);

      // Call backend - DO NOT update local state here
      // WebSocket will broadcast the update and screens will sync
      const response = await apiService.markPatientArrived(sosId);
      console.log(
        "✅ [SOSContext] Backend confirmed ARRIVED status:",
        response
      );

      // Only update AsyncStorage for persistence across app restarts
      // Backend response via WebSocket will update activeSOS
      await AsyncStorage.setItem("sosStatus", "ARRIVED");
      await AsyncStorage.setItem("patientPickedUpTime", Date.now().toString());

      // Trust backend - state will update via WebSocket subscription in screens
    } catch (error: any) {
      console.error("❌ [SOSContext] Error marking patient picked up:", error);
      console.error("❌ [SOSContext] Error response:", error?.response?.data);
      console.error("❌ [SOSContext] Error status:", error?.response?.status);
      throw error;
    }
  };

  // Mark SOS as completed (only after patient is picked up)
  const markSOSCompleted = async (sosId: number) => {
    try {
      const pickedUpTime = await AsyncStorage.getItem("patientPickedUpTime");

      // Only allow completion if patient was picked up
      if (!pickedUpTime) {
        throw new Error("Patient must be picked up before completing SOS");
      }

      console.log("🏁 [SOSContext] Completing SOS:", sosId);

      // Call backend - DO NOT update local state
      // WebSocket broadcast will handle state propagation
      const response = await apiService.completeSOS(sosId);
      console.log(
        "✅ [SOSContext] Backend confirmed COMPLETED status:",
        response
      );

      // Update persistent storage only
      await AsyncStorage.setItem("sosStatus", "COMPLETED");

      // Clear after delay to allow WebSocket updates to propagate
      setTimeout(() => {
        clearActiveSOS();
      }, 2000);

      // State updates via WebSocket subscription in screens
    } catch (error) {
      console.error("❌ [SOSContext] Error completing SOS:", error);
      throw error;
    }
  };

  const clearActiveSOS = async () => {
    try {
      // Clear persistent storage
      await AsyncStorage.removeItem("activeSOS");
      await AsyncStorage.removeItem("sosStatus");
      await AsyncStorage.removeItem("patientPickedUpTime");

      // Clear state
      setActiveSOS(null);
      setAcceptedSOS(null);
    } catch (error) {
      console.error("Error clearing active SOS:", error);
    }
  };

  return (
    <SOSContext.Provider
      value={{
        activeSOS,
        acceptedSOS,
        isLoadingActiveSOS,
        acceptSOS,
        markPatientPickedUp,
        markSOSCompleted,
        clearActiveSOS,
        checkForActiveSOS,
      }}
    >
      {children}
    </SOSContext.Provider>
  );
};

export const useSOSContext = () => {
  const context = useContext(SOSContext);
  if (!context) {
    throw new Error("useSOSContext must be used within SOSProvider");
  }
  return context;
};
