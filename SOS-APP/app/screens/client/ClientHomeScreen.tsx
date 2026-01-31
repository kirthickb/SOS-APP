import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { ClientStackParamList } from "../../navigation/AppNavigator";
import { useAuth } from "../../context/AuthContext";
import { useSOSContext } from "../../context/SOSContext";
import apiService from "../../services/api";

type NavigationProp = NativeStackNavigationProp<ClientStackParamList>;

const ClientHomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { logout } = useAuth();
  const { activeSOS, isSosActive, cancelSOS, isLoadingActiveSOS } =
    useSOSContext();
  const [loading, setLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  // Disable back button when SOS is active - user can only navigate away by canceling
  useEffect(() => {
    if (isSosActive) {
      navigation.setOptions({
        headerLeft: () => null, // Hide back button
        gestureEnabled: false, // Disable swipe back gesture on iOS
      });
    } else {
      navigation.setOptions({
        headerLeft: undefined, // Show default back button
        gestureEnabled: true, // Enable swipe back gesture on iOS
      });
    }
  }, [isSosActive, navigation]);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationPermission(status === "granted");
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === "granted");

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Location permission is required to send SOS alerts"
      );
    }
  };

  const handleSOS = async () => {
    // Check location permission
    if (!locationPermission) {
      Alert.alert(
        "Location Permission",
        "We need your location to send the SOS alert",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Allow", onPress: requestLocationPermission },
        ]
      );
      return;
    }

    Alert.alert(
      "Send SOS Alert",
      "Are you sure you want to send an emergency alert to nearby ambulances?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send SOS",
          style: "destructive",
          onPress: sendSOS,
        },
      ]
    );
  };

  const sendSOS = async () => {
    setLoading(true);
    try {
      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      // Send SOS to backend
      const sosResponse = await apiService.createSOS({
        latitude,
        longitude,
      });

      Alert.alert(
        "🚨 SOS Sent!",
        "Your emergency alert has been sent to nearby ambulances. Please wait...",
        [
          {
            text: "Track Ambulance",
            onPress: () =>
              navigation.navigate("ClientMap", { sosId: sosResponse.id }),
          },
        ]
      );
    } catch (error: any) {
      console.error("SOS error:", error);
      Alert.alert(
        "Failed to Send SOS",
        error.response?.data?.message || "Please try again"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: logout,
      },
    ]);
  };

  const handleCancelSOS = () => {
    Alert.alert(
      "Cancel Emergency SOS",
      "Are you sure you want to cancel the emergency alert? The ambulance driver may already be on their way.",
      [
        { text: "Keep SOS", style: "cancel" },
        {
          text: "Cancel SOS",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelSOS();
              Alert.alert(
                "SOS Cancelled",
                "Your emergency alert has been cancelled."
              );
            } catch (error) {
              Alert.alert("Error", "Failed to cancel SOS. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Emergency SOS</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#DC2626" />
        </TouchableOpacity>
      </View>

      {/* SOS ACTIVE STATUS BANNER */}
      {isSosActive && (
        <View style={styles.sosActiveBanner}>
          <View style={styles.sosActiveBannerContent}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <View style={styles.sosActiveBannerText}>
              <Text style={styles.sosActiveBannerTitle}>🚨 SOS ACTIVE</Text>
              <Text style={styles.sosActiveBannerSubtitle}>
                Status: {activeSOS?.status}
              </Text>
              {activeSOS?.acceptedDriverName && (
                <Text style={styles.sosActiveBannerDriver}>
                  Driver: {activeSOS.acceptedDriverName}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={handleCancelSOS}
            style={styles.cancelSOSButton}
          >
            <Ionicons name="close-circle" size={28} color="#DC2626" />
          </TouchableOpacity>
        </View>
      )}

      {/* If SOS is loading, show loading state */}
      {isLoadingActiveSOS && !isSosActive && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingText}>Restoring emergency status...</Text>
        </View>
      )}

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#2563EB" />
        <Text style={styles.infoText}>
          Press the SOS button below in case of emergency. Nearby ambulances
          will be notified immediately.
        </Text>
      </View>

      {/* MAIN SOS BUTTON - Hidden if SOS already active */}
      {!isSosActive && (
        <View style={styles.sosContainer}>
          <TouchableOpacity
            style={[styles.sosButton, loading && styles.sosButtonDisabled]}
            onPress={handleSOS}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <>
                <Ionicons name="alert-circle" size={80} color="#fff" />
                <Text style={styles.sosText}>SOS</Text>
                <Text style={styles.sosSubtext}>Emergency</Text>
              </>
            )}
          </TouchableOpacity>

          {loading && (
            <Text style={styles.searchingText}>
              Searching for ambulances...
            </Text>
          )}
        </View>
      )}

      {/* Show map to track when SOS is active */}
      {isSosActive && activeSOS && (
        <TouchableOpacity
          style={styles.trackButton}
          onPress={() =>
            navigation.navigate("ClientMap", { sosId: activeSOS.id })
          }
        >
          <Ionicons name="map" size={20} color="#fff" />
          <Text style={styles.trackButtonText}>Track Ambulance</Text>
        </TouchableOpacity>
      )}

      {!isSosActive && (
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How it works:</Text>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>1</Text>
            <Text style={styles.instructionText}>
              Press the SOS button to send an emergency alert
            </Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>2</Text>
            <Text style={styles.instructionText}>
              Nearby ambulance drivers will receive your location
            </Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>3</Text>
            <Text style={styles.instructionText}>
              First available driver will accept and reach you
            </Text>
          </View>
        </View>
      )}

      {!locationPermission && !isSosActive && (
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestLocationPermission}
        >
          <Ionicons name="location" size={20} color="#fff" />
          <Text style={styles.permissionButtonText}>Enable Location</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  logoutButton: {
    padding: 8,
  },
  // SOS ACTIVE STATUS BANNER STYLES
  sosActiveBanner: {
    backgroundColor: "#FEE2E2",
    borderLeftWidth: 4,
    borderLeftColor: "#DC2626",
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sosActiveBannerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  sosActiveBannerText: {
    marginLeft: 12,
    flex: 1,
  },
  sosActiveBannerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#DC2626",
  },
  sosActiveBannerSubtitle: {
    fontSize: 12,
    color: "#991B1B",
    marginTop: 4,
  },
  sosActiveBannerDriver: {
    fontSize: 12,
    color: "#7F1D1D",
    marginTop: 2,
    fontWeight: "500",
  },
  cancelSOSButton: {
    padding: 8,
  },
  loadingBanner: {
    backgroundColor: "#DBEAFE",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  loadingText: {
    marginLeft: 12,
    color: "#1E40AF",
    fontSize: 14,
  },
  trackButton: {
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginVertical: 20,
  },
  trackButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: "#EFF6FF",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 30,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    color: "#1E40AF",
    fontSize: 14,
    lineHeight: 20,
  },
  sosContainer: {
    alignItems: "center",
    marginVertical: 40,
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sosButtonDisabled: {
    opacity: 0.7,
  },
  sosText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
    marginTop: 8,
  },
  sosSubtext: {
    color: "#fff",
    fontSize: 16,
  },
  searchingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
  },
  instructionsCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    elevation: 2,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  instruction: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DC2626",
    color: "#fff",
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "bold",
    marginRight: 12,
  },
  instructionText: {
    flex: 1,
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default ClientHomeScreen;
