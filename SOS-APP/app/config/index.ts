// Configuration file for SOS App
// Environment variables override defaults

const getEnvVar = (key: string, defaultValue: string): string => {
  // In Expo, environment variables must be set in app.json or .env file
  // For development, hardcoded values are used as fallback
  return process.env[`EXPO_PUBLIC_${key}`] || defaultValue;
};

export const API_CONFIG = {
  // Backend API Base URL
  // Environment variable: EXPO_PUBLIC_API_BASE_URL
  // Defaults:
  // - Android: http://10.223.129.18:8080/api (change IP to your machine)
  // - iOS: http://10.223.129.18:8080/api
  // - Production: https://your-domain.com/api
  BASE_URL: getEnvVar("API_BASE_URL", "http://10.223.129.18:8080/api"),
  SOCKET_URL: getEnvVar("SOCKET_URL", "http://10.223.129.18:8080/ws"),
  TIMEOUT: 10000,
  ENABLE_LOGGING: getEnvVar("ENABLE_LOGGING", "false") === "true",
};

export const MAP_CONFIG = {
  // Google Maps API Key - MUST be set via environment variable for production
  // DO NOT expose in code - use a backend proxy instead
  // Environment variable: EXPO_PUBLIC_GOOGLE_MAPS_KEY
  GOOGLE_MAPS_API_KEY: getEnvVar("GOOGLE_MAPS_KEY", ""),

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
  // Adaptive based on app state
  LOCATION_UPDATE_INTERVAL_ACTIVE: 15000, // 15 seconds when app in foreground
  LOCATION_UPDATE_INTERVAL_BACKGROUND: 30000, // 30 seconds in background
  LOCATION_UPDATE_INTERVAL_SUSPENDED: 60000, // 60 seconds when suspended

  // Password policy
  MIN_PASSWORD_LENGTH: 8,
  PASSWORD_PATTERN:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,

  // Phone number validation
  PHONE_NUMBER_LENGTH: 10,
  PHONE_PATTERN: /^[0-9]{10}$/,

  // Average ambulance speed (km/h) for ETA calculation
  AVERAGE_SPEED: 40,

  // Token refresh threshold (refresh if expiry within 5 minutes)
  TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000,

  // Max retry attempts for API calls
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
};
