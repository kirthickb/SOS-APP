import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DriverStackParamList } from "../../navigation/AppNavigator";
import { Location as LocationType } from "../../types";
import { useSOSContext } from "../../context/SOSContext";
import {
  getRouteCoordinates,
  calculateDistance,
  formatDistance,
  getEstimatedTime,
} from "../../utils/location";
import apiService from "../../services/api";
import socketService from "../../services/socket";

type DriverMapRouteProp = RouteProp<DriverStackParamList, "DriverMap">;
type NavigationProp = NativeStackNavigationProp<DriverStackParamList>;

const DriverMapScreen: React.FC = () => {
  const route = useRoute<DriverMapRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { sosId } = route.params;
  const { markPatientPickedUp, markSOSCompleted, activeSOS } = useSOSContext();

  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState<LocationType | null>(
    null
  );
  const [patientLocation, setPatientLocation] = useState<LocationType | null>(
    null
  );
  const [routeCoordinates, setRouteCoordinates] = useState<LocationType[]>([]);
  const [distance, setDistance] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  const [sosStatus, setSOSStatus] = useState<string>("ACCEPTED");
  const [isPickedUp, setIsPickedUp] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Sync local state ONLY from activeSOS (backend truth via WebSocket)
  useEffect(() => {
    if (activeSOS && activeSOS.id === sosId) {
      console.log("📡 [DriverMap] Syncing from activeSOS:", activeSOS.status);
      setSOSStatus(activeSOS.status);

      // Derive isPickedUp flag from backend status only
      const pickedUp =
        activeSOS.status === "ARRIVED" || activeSOS.status === "COMPLETED";
      setIsPickedUp(pickedUp);

      if (activeSOS.latitude && activeSOS.longitude) {
        setPatientLocation({
          latitude: activeSOS.latitude,
          longitude: activeSOS.longitude,
        });
      }
    }
  }, [activeSOS, sosId]);

  useEffect(() => {
    initializeMap();

    // Update driver location every 5 seconds for real-time tracking
    const interval = setInterval(updateDriverLocation, 5000);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to SOS updates via WebSocket - this is the ONLY source of status updates
  useEffect(() => {
    const unsubscribe = socketService.subscribeToSOS((sos) => {
      if (sos.id === sosId) {
        console.log("📡 [DriverMap] WebSocket update received:", sos.status);

        // Update patient location
        setPatientLocation({
          latitude: sos.latitude,
          longitude: sos.longitude,
        });

        // Update status from WebSocket (backend truth)
        setSOSStatus(sos.status);

        // Derive pickup flag from status
        const pickedUp = sos.status === "ARRIVED" || sos.status === "COMPLETED";
        setIsPickedUp(pickedUp);

        // Navigate back ONLY when status is COMPLETED
        if (sos.status === "COMPLETED") {
          setTimeout(() => {
            Alert.alert("SOS Completed", "Emergency has been completed.", [
              { text: "OK", onPress: () => navigation.goBack() },
            ]);
          }, 1000);
        }
      }
    });
    return () => unsubscribe();
  }, [sosId, navigation]);

  const initializeMap = async () => {
    try {
      // Fetch latest SOS data from backend to ensure we have correct status
      try {
        const sosData = await apiService.getSOS(sosId);
        console.log("📋 Fetched SOS data on mount:", sosData);
        setSOSStatus(sosData.status);
        if (
          sosData.status === ("ARRIVED" as any) ||
          sosData.status === ("COMPLETED" as any)
        ) {
          setIsPickedUp(true);
        }
        if (sosData.latitude && sosData.longitude) {
          setPatientLocation({
            latitude: sosData.latitude,
            longitude: sosData.longitude,
          });
        }
      } catch (error) {
        console.error("Failed to fetch SOS data:", error);
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const currentLocation: LocationType = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setDriverLocation(currentLocation);

      // Calculate route/metrics only when patient's location is known
      if (patientLocation) {
        const route = await getRouteCoordinates(
          currentLocation,
          patientLocation
        );
        setRouteCoordinates(route);

        const dist = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          patientLocation.latitude,
          patientLocation.longitude
        );
        setDistance(dist);

        const time = await getEstimatedTime(currentLocation, patientLocation);
        setEstimatedTime(time);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error initializing map:", error);
      Alert.alert("Error", "Failed to load map");
      setLoading(false);
    }
  };

  const updateDriverLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation: LocationType = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setDriverLocation(newLocation);

      // Send location update to backend
      try {
        await apiService.updateDriverLocation({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
        });
        console.log("📍 Driver location updated on server");
      } catch (error) {
        console.error("Error updating location on server:", error);
      }

      // Recalculate only if patient location is available
      if (patientLocation) {
        const route = await getRouteCoordinates(newLocation, patientLocation);
        setRouteCoordinates(route);

        const dist = calculateDistance(
          newLocation.latitude,
          newLocation.longitude,
          patientLocation.latitude,
          patientLocation.longitude
        );
        setDistance(dist);

        const time = await getEstimatedTime(newLocation, patientLocation);
        setEstimatedTime(time);
      }
    } catch (error) {
      console.error("Error updating location:", error);
    }
  };

  const openGoogleMaps = () => {
    if (!patientLocation) {
      Alert.alert("Patient location not available yet");
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${patientLocation.latitude},${patientLocation.longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Could not open Google Maps");
    });
  };

  const callPatient = () => {
    // In production, get patient phone from SOS data
    Alert.alert(
      "Call Patient",
      "This feature requires patient phone number from SOS data"
    );
  };

  const handlePatientPickedUp = async () => {
    // Prevent duplicate ARRIVED calls if already picked up
    if (sosStatus !== "ACCEPTED") {
      Alert.alert(
        "Already Updated",
        `Patient pickup is already recorded. Current status: ${sosStatus}`
      );
      setIsPickedUp(true);
      return;
    }

    Alert.alert(
      "Patient Picked Up",
      "Confirm that you have picked up the patient?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setIsCompleting(true);
              console.log(
                "🚑 [DriverMap] Marking patient picked up, current status:",
                sosStatus
              );

              // Call backend - DO NOT update local state
              // WebSocket will broadcast and activeSOS useEffect will update UI
              await markPatientPickedUp(sosId);

              Alert.alert(
                "Success",
                "Patient pickup confirmed. Head to hospital now."
              );
              // State will update via WebSocket -> activeSOS -> useEffect
            } catch (error: any) {
              console.error(
                "❌ [DriverMap] Failed to mark patient picked up:",
                error
              );
              const errorMessage =
                error?.response?.data?.message ||
                error?.response?.data ||
                error?.message ||
                "Failed to update patient status";
              Alert.alert("Error", `Failed to update status: ${errorMessage}`);
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ]
    );
  };

  const handleCompleteEmergency = async () => {
    if (!isPickedUp) {
      Alert.alert(
        "Cannot Complete",
        "Mark patient as picked up before completing the emergency."
      );
      return;
    }

    Alert.alert(
      "Complete Emergency",
      "Confirm that you have delivered the patient to the hospital?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setIsCompleting(true);
              console.log(
                "🏁 [DriverMap] Completing SOS, current status:",
                sosStatus
              );

              // Call backend - state update via WebSocket
              await markSOSCompleted(sosId);

              // WebSocket will update status to COMPLETED
              // Navigation will happen via WebSocket subscription useEffect
              Alert.alert("Success", "Emergency completed successfully!");
              // Don't navigate here - let WebSocket update trigger navigation
            } catch (error: any) {
              console.error(
                "❌ [DriverMap] Failed to complete emergency:",
                error
              );
              const errorMessage =
                error?.response?.data?.message ||
                error?.response?.data ||
                error?.message ||
                "Failed to complete emergency";
              Alert.alert("Error", `Failed to complete: ${errorMessage}`);
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !driverLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>
          {patientLocation ? "Loading route..." : "Waiting for SOS details..."}
        </Text>
      </View>
    );
  }

  const region = patientLocation
    ? {
        latitude: (driverLocation.latitude + patientLocation.latitude) / 2,
        longitude: (driverLocation.longitude + patientLocation.longitude) / 2,
        latitudeDelta:
          Math.abs(driverLocation.latitude - patientLocation.latitude) * 2,
        longitudeDelta:
          Math.abs(driverLocation.longitude - patientLocation.longitude) * 2,
      }
    : {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Driver Marker */}
        <Marker
          coordinate={driverLocation}
          title="Your Location"
          description="Ambulance"
        >
          <View style={styles.driverMarker}>
            <Text style={styles.markerText}>🚑</Text>
          </View>
        </Marker>

        {/* Patient Marker */}
        {patientLocation && (
          <Marker
            coordinate={patientLocation}
            title="Patient Location"
            description="Emergency"
            pinColor="red"
          />
        )}

        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2563EB"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="navigate" size={20} color="#2563EB" />
            <Text style={styles.infoValue}>{formatDistance(distance)}</Text>
            <Text style={styles.infoLabel}>Distance</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoItem}>
            <Ionicons name="time" size={20} color="#2563EB" />
            <Text style={styles.infoValue}>{estimatedTime} min</Text>
            <Text style={styles.infoLabel}>
              {sosStatus === "ARRIVED" ? "Arrival Time" : "ETA"}
            </Text>
          </View>
        </View>
      </View>

      {/* Status Badge */}
      <View
        style={[
          styles.statusBadge,
          sosStatus === "COMPLETED" && styles.statusBadgeCompleted,
          sosStatus === "ARRIVED" && styles.statusBadgeArrived,
        ]}
      >
        <Text style={styles.statusText}>
          {sosStatus === "COMPLETED"
            ? "✅ Emergency Completed"
            : sosStatus === "ARRIVED"
            ? "✓ Patient Picked Up - En Route to Hospital"
            : "→ En Route to Patient"}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.callButton} onPress={callPatient}>
          <Ionicons name="call" size={24} color="#fff" />
          <Text style={styles.buttonText}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navigateButton}
          onPress={openGoogleMaps}
        >
          <Ionicons name="navigate-circle" size={24} color="#fff" />
          <Text style={styles.buttonText}>Maps</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pickupButton,
            isPickedUp && styles.pickupButtonCompleted,
          ]}
          onPress={handlePatientPickedUp}
          disabled={isPickedUp || isCompleting || sosStatus !== "ACCEPTED"}
        >
          <Ionicons
            name={isPickedUp ? "checkmark-done" : "checkmark"}
            size={24}
            color="#fff"
          />
          <Text style={styles.buttonText}>
            {isPickedUp ? "Picked" : "Pickup"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.completeButton,
            !isPickedUp && styles.completeButtonDisabled,
          ]}
          onPress={handleCompleteEmergency}
          disabled={!isPickedUp || isCompleting}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  map: {
    flex: 1,
  },
  driverMarker: {
    backgroundColor: "#2563EB",
    borderRadius: 25,
    padding: 8,
    borderWidth: 3,
    borderColor: "#fff",
  },
  markerText: {
    fontSize: 24,
  },
  infoCard: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  infoItem: {
    alignItems: "center",
    flex: 1,
  },
  divider: {
    width: 1,
    backgroundColor: "#e5e5e5",
    marginHorizontal: 16,
  },
  infoValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  statusBadge: {
    position: "absolute",
    top: 140,
    left: 20,
    right: 20,
    backgroundColor: "#FFC107",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    elevation: 3,
  },
  statusBadgeArrived: {
    backgroundColor: "#10B981",
  },
  statusBadgeCompleted: {
    backgroundColor: "#3B82F6",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  actionContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  callButton: {
    flex: 0.9,
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    marginRight: 6,
    elevation: 5,
  },
  navigateButton: {
    flex: 0.9,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    marginRight: 6,
    elevation: 5,
  },
  pickupButton: {
    flex: 0.9,
    backgroundColor: "#F59E0B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    marginRight: 6,
    elevation: 5,
  },
  pickupButtonCompleted: {
    backgroundColor: "#10B981",
  },
  completeButton: {
    flex: 0.9,
    backgroundColor: "#DC2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    elevation: 5,
  },
  completeButtonDisabled: {
    backgroundColor: "#999",
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
});

export default DriverMapScreen;
