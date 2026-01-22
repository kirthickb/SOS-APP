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
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute } from "@react-navigation/native";
import { DriverStackParamList } from "../../navigation/AppNavigator";
import { Location as LocationType } from "../../types";
import {
  getRouteCoordinates,
  calculateDistance,
  formatDistance,
  getEstimatedTime,
} from "../../utils/location";
import apiService from "../../services/api";
import socketService from "../../services/socket";

type DriverMapRouteProp = RouteProp<DriverStackParamList, "DriverMap">;

const DriverMapScreen: React.FC = () => {
  const route = useRoute<DriverMapRouteProp>();
  const { sosId } = route.params;
  
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

  useEffect(() => {
    initializeMap();

    // Update driver location every 5 seconds for real-time tracking
    const interval = setInterval(updateDriverLocation, 5000);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to SOS updates to get patient's location from backend in real-time
  useEffect(() => {
    const unsubscribe = socketService.subscribeToSOS((sos) => {
      if (sos.id === sosId) {
        setPatientLocation({
          latitude: sos.latitude,
          longitude: sos.longitude,
        });
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sosId]);

  const initializeMap = async () => {
    try {
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
        provider={PROVIDER_DEFAULT}
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
            <Text style={styles.infoLabel}>ETA</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.callButton} onPress={callPatient}>
          <Ionicons name="call" size={24} color="#fff" />
          <Text style={styles.buttonText}>Call Patient</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navigateButton}
          onPress={openGoogleMaps}
        >
          <Ionicons name="navigate-circle" size={24} color="#fff" />
          <Text style={styles.buttonText}>Open Maps</Text>
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
  actionContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  callButton: {
    flex: 1,
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginRight: 8,
    elevation: 5,
  },
  navigateButton: {
    flex: 1,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginLeft: 8,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default DriverMapScreen;
