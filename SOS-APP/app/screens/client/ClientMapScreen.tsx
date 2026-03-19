import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  BackHandler,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { ClientStackParamList } from "../../navigation/AppNavigator";
import socketService from "../../services/socket";
import { SOSResponse } from "../../types";
import apiService from "../../services/api";
import {
  getRouteCoordinates,
  calculateDistance,
  formatDistance,
  getEstimatedTime,
} from "../../utils/location";

type ClientMapRouteProp = RouteProp<ClientStackParamList, "ClientMap">;

const ClientMapScreen: React.FC = () => {
  const route = useRoute<ClientMapRouteProp>();
  const { sosId } = route.params;

  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState(false);
  const [sosData, setSosData] = useState<SOSResponse | null>(null);
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [displayDriverLocation, setDisplayDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const mapViewRef = useRef<MapView>(null);
  const socketUnsubscribeRef = useRef<(() => void) | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const markerAnimationRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  useEffect(() => {
    initializeMap();
    return () => {
      if (socketUnsubscribeRef.current) {
        socketUnsubscribeRef.current();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (markerAnimationRef.current) {
        clearInterval(markerAnimationRef.current);
        markerAnimationRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prevent back navigation when on map screen during active SOS
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => null, // Hide back button
      gestureEnabled: false, // Disable iOS swipe-back gesture
    });
  }, [navigation]);

  // Block Android hardware back until SOS is completed/cancelled
  useEffect(() => {
    const onBackPress = () => {
      if (sosData?.status === "COMPLETED" || sosData?.status === "CANCELLED") {
        return false; // allow default behavior
      }
      return true; // block back
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );

    return () => subscription.remove();
  }, [sosData?.status]);

  useEffect(() => {
    // Update route and distance when driver location changes
    if (currentLocation && driverLocation) {
      updateRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation, currentLocation]);

  useEffect(() => {
    if (!driverLocation) return;

    if (!displayDriverLocation) {
      setDisplayDriverLocation(driverLocation);
      return;
    }

    if (markerAnimationRef.current) {
      clearInterval(markerAnimationRef.current);
      markerAnimationRef.current = null;
    }

    const start = displayDriverLocation;
    const end = driverLocation;
    const durationMs = 1800;
    const stepMs = 100;
    const steps = Math.max(1, Math.floor(durationMs / stepMs));
    let currentStep = 0;

    markerAnimationRef.current = setInterval(() => {
      currentStep += 1;
      const t = Math.min(1, currentStep / steps);

      setDisplayDriverLocation({
        latitude: start.latitude + (end.latitude - start.latitude) * t,
        longitude: start.longitude + (end.longitude - start.longitude) * t,
      });

      if (t >= 1 && markerAnimationRef.current) {
        clearInterval(markerAnimationRef.current);
        markerAnimationRef.current = null;
      }
    }, stepMs);

    return () => {
      if (markerAnimationRef.current) {
        clearInterval(markerAnimationRef.current);
        markerAnimationRef.current = null;
      }
    };
  }, [driverLocation, displayDriverLocation]);

  // Auto-follow user location when enabled
  const handleMapRegionChangeComplete = () => {
    if (followUser && currentLocation && mapViewRef.current) {
      const clientCoords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      mapViewRef.current.animateToRegion(clientCoords, 500);
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      // Use expo-location only for cross-platform permissions
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== "granted") {
        console.warn("Location permission denied");
        return false;
      }

      setLocationPermissionGranted(true);
      return true;
    } catch (err) {
      console.error("Error requesting location permission:", err);
      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        throw new Error("Location permission is required to use this feature");
      }

      console.log("⏳ Getting current location with High accuracy...");

      // Try high accuracy first with generous timeout
      try {
        const location = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            mayShowUserSettingsDialog: true,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("High accuracy timeout")), 15000)
          ),
        ]);
        console.log("✅ Got high accuracy location:", location.coords);
        setCurrentLocation(location);
        return location;
      } catch (highAccuracyError) {
        console.warn(
          "⚠️ High accuracy failed, trying balanced accuracy...",
          highAccuracyError
        );

        // Fallback to balanced accuracy
        try {
          const location = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 3000,
              mayShowUserSettingsDialog: true,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Balanced accuracy timeout")),
                10000
              )
            ),
          ]);
          console.log("✅ Got balanced accuracy location:", location.coords);
          setCurrentLocation(location);
          return location;
        } catch (balancedError) {
          console.warn(
            "⚠️ Balanced accuracy failed, trying lowest accuracy...",
            balancedError
          );

          // Last resort: lowest accuracy (network-based)
          try {
            const location = await Promise.race([
              Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Lowest,
                timeInterval: 3000,
                mayShowUserSettingsDialog: true,
              }),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error("Lowest accuracy timeout")),
                  8000
                )
              ),
            ]);
            console.log("✅ Got lowest accuracy location:", location.coords);
            setCurrentLocation(location);
            return location;
          } catch (lowestError) {
            console.error("❌ All location methods failed:", lowestError);
            throw new Error(
              "Unable to get your location. Please check: GPS enabled, location services active, and try again."
            );
          }
        }
      }
    } catch (error) {
      console.error("❌ Error getting current location:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to get current location";
      setError(errorMessage);
      throw error;
    }
  };

  const updateRoute = async () => {
    if (!currentLocation?.coords || !driverLocation) return;

    try {
      const start = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      // Validate coordinates before processing
      if (
        isNaN(start.latitude) ||
        isNaN(start.longitude) ||
        isNaN(driverLocation.latitude) ||
        isNaN(driverLocation.longitude)
      ) {
        console.error("Invalid coordinates detected");
        return;
      }

      const coordinates = await getRouteCoordinates(start, driverLocation);
      setRouteCoordinates(coordinates);

      const dist = calculateDistance(
        start.latitude,
        start.longitude,
        driverLocation.latitude,
        driverLocation.longitude
      );
      setDistance(dist);

      const time = await getEstimatedTime(start, driverLocation);
      setEstimatedTime(time);
    } catch (error) {
      console.error("Error updating route:", error);
      // Set fallback direct line with validated coordinates
      if (currentLocation && driverLocation) {
        setRouteCoordinates([
          {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          },
          driverLocation,
        ]);
      }
    }
  };

  const subscribeToDriverUpdates = () => {
    socketUnsubscribeRef.current = socketService.subscribeToSOS((sos) => {
      if (sos.id === sosId) {
        console.log("📍 [ClientMap] SOS Update received:", sos);
        setSosData(sos);

        // Handle status-based alerts - CRITICAL: ARRIVED means driver picked up patient
        if (sos.status === "ARRIVED") {
          Alert.alert(
            "🚑 Ambulance Arrived!",
            "The ambulance has arrived and picked up the patient.",
            [{ text: "OK" }]
          );
        } else if (sos.status === "COMPLETED") {
          Alert.alert(
            "✅ Emergency Completed",
            "Your emergency has been successfully handled. Stay safe!",
            [
              {
                text: "OK",
                onPress: () => {
                  // Unsubscribe from socket updates
                  if (socketUnsubscribeRef.current) {
                    socketUnsubscribeRef.current();
                  }
                },
              },
            ]
          );
        }

        // Set client location from SOS data if not already set
        if (!currentLocation) {
          setCurrentLocation(
            (prevLocation) =>
              prevLocation ||
              ({
                coords: {
                  latitude: sos.latitude,
                  longitude: sos.longitude,
                  altitude: 0,
                  accuracy: 10,
                  altitudeAccuracy: 0,
                  heading: 0,
                  speed: 0,
                },
                timestamp: Date.now(),
              } as Location.LocationObject)
          );
        }

        // Update driver location if driver has accepted and location is available
        if (sos.driverLatitude != null && sos.driverLongitude != null) {
          console.log(
            "🚑 Updating driver location:",
            sos.driverLatitude,
            sos.driverLongitude
          );
          setDriverLocation({
            latitude: sos.driverLatitude,
            longitude: sos.driverLongitude,
          });
        }
      }
    });
  };

  const syncSOSState = async () => {
    try {
      const latestSos = await apiService.getSOS(sosId);
      setSosData(latestSos);

      if (
        latestSos.driverLatitude != null &&
        latestSos.driverLongitude != null
      ) {
        setDriverLocation({
          latitude: latestSos.driverLatitude,
          longitude: latestSos.driverLongitude,
        });
      }
    } catch (syncError) {
      console.error("❌ [ClientMap] Failed to sync SOS state:", syncError);
    }
  };

  const initializeMap = async () => {
    try {
      setError(null);

      // Request permission and get location first (critical for map to render)
      await getCurrentLocation();


      // Subscribe to socket updates for real-time SOS and driver location
      subscribeToDriverUpdates();

      // Fetch initial SOS data to populate driver details if already accepted
      try {
        const initialSos = await apiService.getSOS(sosId);
        console.log("📋 [ClientMap] Initial SOS data:", initialSos);
        setSosData(initialSos);
        
        // Update driver location if already accepted
        if (
          initialSos.driverLatitude != null &&
          initialSos.driverLongitude != null
        ) {
          console.log("🚑 [ClientMap] Setting initial driver location");
          setDriverLocation({
            latitude: initialSos.driverLatitude,
            longitude: initialSos.driverLongitude,
          });
        }

        // Poll backend as fallback in case WebSocket updates are delayed or dropped.
        pollingIntervalRef.current = setInterval(() => {
          syncSOSState();
        }, 5000);
      } catch (sosError) {
        console.error("❌ [ClientMap] Error fetching initial SOS:", sosError);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error initializing map:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to initialize map";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);

      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>⚠️ Error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Critical: Don't render MapView until we have valid coordinates
  if (!currentLocation?.coords) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>⚠️ Location Unavailable</Text>
        <Text style={styles.errorText}>
          Unable to get your current location
        </Text>
      </View>
    );
  }

  // Validate coordinates before creating region
  const clientCoords = {
    latitude: currentLocation.coords.latitude,
    longitude: currentLocation.coords.longitude,
  };

  // Additional validation to prevent crashes
  if (
    isNaN(clientCoords.latitude) ||
    isNaN(clientCoords.longitude) ||
    Math.abs(clientCoords.latitude) > 90 ||
    Math.abs(clientCoords.longitude) > 180
  ) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>⚠️ Invalid Location</Text>
        <Text style={styles.errorText}>Location coordinates are invalid</Text>
      </View>
    );
  }

  const initialRegion = {
    latitude: clientCoords.latitude,
    longitude: clientCoords.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapViewRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={locationPermissionGranted}
        showsMyLocationButton={false}
        loadingEnabled={true}
        loadingIndicatorColor="#DC2626"
        loadingBackgroundColor="#f5f5f5"
        onRegionChangeComplete={handleMapRegionChangeComplete}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        {/* Client Marker */}
        <Marker
          coordinate={clientCoords}
          title="Your Location"
          description="You are here"
          pinColor="#EF4444"
        />

        {/* Driver Marker (when available) */}
        {driverLocation && (
          <Marker
            coordinate={displayDriverLocation || driverLocation}
            title="Ambulance"
            description={`${formatDistance(distance || 0)} away`}
            pinColor="#3B82F6"
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerText}>🚑</Text>
            </View>
          </Marker>
        )}

        {/* Route Polyline (from OSRM - free routing) */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2563EB"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Follow User Button */}
      {locationPermissionGranted && (
        <TouchableOpacity
          style={[styles.followButton, followUser && styles.followButtonActive]}
          onPress={() => {
            setFollowUser(!followUser);
            if (!followUser && currentLocation && mapViewRef.current) {
              const clientCoords = {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              };
              mapViewRef.current.animateToRegion(clientCoords, 500);
            }
          }}
        >
          <Text style={styles.followButtonText}>
            {followUser ? "📍" : "🎯"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          {sosData?.status === "COMPLETED"
            ? "✅ Emergency Completed"
            : sosData?.status === "ACCEPTED"
            ? "🚑 Ambulance En Route!"
            : "🚨 SOS Alert Active"}
        </Text>

        {sosData?.status === "COMPLETED" ? (
          <Text style={styles.infoText}>
            Your emergency has been successfully handled. Stay safe!
          </Text>
        ) : sosData?.status === "ACCEPTED" || sosData?.status === "ARRIVED" ? (
          <>
            <Text style={styles.infoText}>
              <Text style={styles.boldText}>
                The ambulance is on the way to your location
              </Text>
            </Text>
            <Text style={styles.infoText}>
              Driver: {sosData?.acceptedDriverName || "Unknown"}
            </Text>
            {!driverLocation && (
              <Text style={styles.infoText}>Waiting for live ambulance location...</Text>
            )}
          </>
        ) : !driverLocation ? (
          <>
            <Text style={styles.infoText}>
              Searching for nearby ambulances...
            </Text>
            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="small" color="#DC2626" />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.infoText}>
              <Text style={styles.boldText}>Ambulance En Route</Text>
            </Text>
            <Text style={styles.infoText}>
              Driver: {sosData?.acceptedDriverName || "En route"}
            </Text>
            {distance !== null && (
              <Text style={styles.infoText}>
                Distance: {formatDistance(distance)}
              </Text>
            )}
            {estimatedTime !== null && estimatedTime > 0 && (
              <Text style={styles.infoText}>
                ETA: ~{estimatedTime} minute{estimatedTime !== 1 ? "s" : ""}
              </Text>
            )}
          </>
        )}

        <Text style={styles.infoSubtext}>
          📍 Your location is being shared with emergency services
        </Text>
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#DC2626",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
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
    backgroundColor: "#3B82F6",
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  driverMarkerText: {
    fontSize: 20,
  },
  infoCard: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#DC2626",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: "600",
  },
  infoSubtext: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  loadingIndicator: {
    marginVertical: 8,
  },
  followButton: {
    position: "absolute",
    bottom: 120,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  followButtonActive: {
    backgroundColor: "#3B82F6",
  },
  followButtonText: {
    fontSize: 24,
  },
});

export default ClientMapScreen;
