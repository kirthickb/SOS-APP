// Configuration file for SOS App

export const API_CONFIG = {
  // Backend API Base URL
  // Change this based on your environment:
  // - Android Emulator: 'http://localhost:8080/api'
  // - iOS Simulator: 'http://localhost:8080/api'
  // - Physical Device: 'http://YOUR_COMPUTER_IP:8080/api'
  BASE_URL: "http://localhost:8080/api",

  // WebSocket URL
  SOCKET_URL: "http://localhost:8080/ws",

  // Timeout for API requests (milliseconds)
  TIMEOUT: 10000,
};

export const MAP_CONFIG = {
  // OpenStreetMap tile URL (no API key needed)
  OSM_TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

  // OSRM Routing Service URL (free)
  OSRM_URL: "https://router.project-osrm.org/route/v1/driving",

  // Default map region (India)
  DEFAULT_REGION: {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 30,
    longitudeDelta: 30,
  },
};

export const APP_CONFIG = {
  // Location update interval for drivers (milliseconds)
  LOCATION_UPDATE_INTERVAL: 30000, // 30 seconds

  // Minimum password length
  MIN_PASSWORD_LENGTH: 6,

  // Phone number length
  PHONE_NUMBER_LENGTH: 10,

  // Average ambulance speed (km/h) for ETA calculation
  AVERAGE_SPEED: 40,
};
