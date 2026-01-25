import React, { useEffect, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { UserRole } from "../types";
import { useAuth } from "../context/AuthContext";
import { useSOSContext } from "../context/SOSContext";

// Client Screens
import ClientHomeScreen from "../screens/client/ClientHomeScreen";
import ClientProfileScreen from "../screens/client/ClientProfileScreen";
import ClientMapScreen from "../screens/client/ClientMapScreen";

// Driver Screens
import DriverHomeScreen from "../screens/driver/DriverHomeScreen";
import DriverProfileScreen from "../screens/driver/DriverProfileScreen";
import DriverMapScreen from "../screens/driver/DriverMapScreen";

// Type definitions
export type ClientTabParamList = {
  ClientHome: undefined;
  ClientProfile: undefined;
};

export type ClientStackParamList = {
  ClientTabs: undefined;
  ClientMap: { sosId: number };
};

export type DriverTabParamList = {
  DriverHome: undefined;
  DriverProfile: undefined;
};

export type DriverStackParamList = {
  DriverTabs: undefined;
  DriverMap: { sosId: number };
};

const ClientTab = createBottomTabNavigator<ClientTabParamList>();
const ClientStack = createNativeStackNavigator<ClientStackParamList>();

const DriverTab = createBottomTabNavigator<DriverTabParamList>();
const DriverStack = createNativeStackNavigator<DriverStackParamList>();

// Client Tab Navigator
const ClientTabNavigator: React.FC = () => {
  return (
    <ClientTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home";

          if (route.name === "ClientHome") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "ClientProfile") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#DC2626",
        tabBarInactiveTintColor: "gray",
        headerStyle: {
          backgroundColor: "#DC2626",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      })}
    >
      <ClientTab.Screen
        name="ClientHome"
        component={ClientHomeScreen}
        options={{ title: "SOS Emergency" }}
      />
      <ClientTab.Screen
        name="ClientProfile"
        component={ClientProfileScreen}
        options={{ title: "My Profile" }}
      />
    </ClientTab.Navigator>
  );
};

// Client Stack Navigator
const ClientNavigator: React.FC = () => {
  return (
    <ClientStack.Navigator>
      <ClientStack.Screen
        name="ClientTabs"
        component={ClientTabNavigator}
        options={{ headerShown: false }}
      />
      <ClientStack.Screen
        name="ClientMap"
        component={ClientMapScreen}
        options={{
          title: "Ambulance Location",
          headerStyle: {
            backgroundColor: "#DC2626",
          },
          headerTintColor: "#fff",
        }}
      />
    </ClientStack.Navigator>
  );
};

// Driver Tab Navigator with Active SOS Detection
const DriverTabNavigator: React.FC<{ navigationRef: any }> = ({
  navigationRef,
}) => {
  const { acceptedSOS, isLoadingActiveSOS } = useSOSContext();

  // Navigate to map if there's an active accepted SOS
  useEffect(() => {
    if (!isLoadingActiveSOS && acceptedSOS) {
      navigationRef.current?.navigate("DriverMap", { sosId: acceptedSOS });
    }
  }, [acceptedSOS, isLoadingActiveSOS, navigationRef]);

  return (
    <DriverTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home";

          if (route.name === "DriverHome") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "DriverProfile") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "gray",
        headerStyle: {
          backgroundColor: "#2563EB",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      })}
    >
      <DriverTab.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{ title: "Emergency Alerts" }}
      />
      <DriverTab.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{ title: "My Profile" }}
      />
    </DriverTab.Navigator>
  );
};

// Driver Stack Navigator
const DriverNavigator: React.FC<{ navigationRef: any }> = ({
  navigationRef,
}) => {
  return (
    <DriverStack.Navigator>
      <DriverStack.Screen name="DriverTabs" options={{ headerShown: false }}>
        {() => <DriverTabNavigator navigationRef={navigationRef} />}
      </DriverStack.Screen>
      <DriverStack.Screen
        name="DriverMap"
        component={DriverMapScreen}
        options={{
          title: "Navigate to Patient",
          headerStyle: {
            backgroundColor: "#2563EB",
          },
          headerTintColor: "#fff",
        }}
      />
    </DriverStack.Navigator>
  );
};

// Main App Navigator - Role-based routing
const AppNavigator: React.FC = () => {
  const { userRole } = useAuth();
  const navigationRef = useRef(null);

  if (userRole === UserRole.CLIENT) {
    return <ClientNavigator />;
  } else if (userRole === UserRole.DRIVER) {
    return <DriverNavigator navigationRef={navigationRef} />;
  }

  return null;
};

export default AppNavigator;
