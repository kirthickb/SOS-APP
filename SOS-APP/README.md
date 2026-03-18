# Rapid Rescue - Emergency Ambulance Application

A production-ready React Native (Expo + TypeScript) mobile application for emergency ambulance services with real-time tracking and WebSocket-based SOS alerts.

## 🚀 Features

### For Clients (Patients)

- **One-Click SOS**: Emergency button to send SOS alert with current location
- **Real-time Tracking**: Track assigned ambulance location on map
- **Health Profile**: Store medical information, blood group, emergency contacts
- **Location Services**: Automatic GPS location detection with permission handling

### For Drivers (Ambulance)

- **Live SOS Alerts**: Receive real-time emergency notifications via WebSocket
- **Accept Requests**: View and accept SOS requests with distance calculation
- **Navigation**: Turn-by-turn navigation to patient location
- **Online/Offline Toggle**: Control availability status
- **Driver Profile**: Manage vehicle details and service city

## 📋 Tech Stack

- **Framework**: React Native with Expo SDK
- **Language**: TypeScript
- **Navigation**: React Navigation v6
- **State Management**: Context API (AuthContext, SocketContext, SOSContext)
- **API Communication**: Axios with JWT interceptors
- **Real-time**: STOMP over SockJS WebSocket (`/topic/sos` + user topics)
- **Maps**: `react-native-maps` with Google Maps provider + Directions API
- **Location**: `expo-location`
- **Storage**: AsyncStorage for persisted SOS state (activeSOS, status)

## 🛠️ Prerequisites

- Node.js 16+ and npm
- Expo CLI: `npm install -g expo-cli`
- Android Studio (for Android emulator) or Xcode (for iOS simulator)
- Running backend server (Spring Boot on port 8080)

## 📦 Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Configure Backend URL**:

   Edit `app/config/index.ts` (API_CONFIG):

   ```typescript
   // For Android Emulator (default)
   BASE_URL: "http://192.168.1.4:8080/api",

   // For iOS Simulator
   BASE_URL: "http://192.168.1.4:8080/api",

   // For Physical Device (replace with your computer's IP)
   BASE_URL: "http://192.168.1.X:8080/api",
   ```

   WebSocket endpoint is set in `app/services/socket.ts`:

   ```typescript
   const WS_URL = "http://192.168.1.4:8080/ws";
   ```

3. **Start the development server**:

   ```bash
   npx expo start
   ```

4. **Run on device/emulator**:
   - Press `a` for Android
   - Press `i` for iOS
   - Scan QR code with Expo Go app on physical device

## 📱 Application Structure

```
app/
├── context/
│   ├── AuthContext.tsx          # Authentication
│   ├── SocketContext.tsx        # WebSocket connection
│   └── SOSContext.tsx           # SOS lifecycle + persistence
├── navigation/
│   ├── AuthNavigator.tsx        # Login/Register flows
│   └── AppNavigator.tsx         # Role-based navigation (Client/Driver)
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   └── RegisterScreen.tsx
│   ├── client/
│   │   ├── ClientHomeScreen.tsx    # SOS button
│   │   ├── ClientProfileScreen.tsx # Health information
│   │   └── ClientMapScreen.tsx     # Track ambulance + alerts
│   └── driver/
│       ├── DriverHomeScreen.tsx    # SOS alerts list
│       ├── DriverProfileScreen.tsx # Vehicle information
│       └── DriverMapScreen.tsx     # Navigation + status updates
├── services/
│   ├── api.ts                   # Axios API service with JWT
│   └── socket.ts                # WebSocket (STOMP + SockJS)
├── types/
│   └── index.ts                 # TypeScript enums & interfaces
├── utils/
│   └── location.ts              # Routing, distance, ETA helpers
└── config/
   └── index.ts                 # API base URL, maps config
```

## 🔐 Authentication Flow

1. **Register**: Choose role (CLIENT or DRIVER), provide name, phone, password
2. **Login**: Phone number and password
3. **JWT Token**: Stored in AsyncStorage, auto-injected in API requests
4. **Auto-login**: Check saved token on app start
5. **Logout**: Clear token and disconnect WebSocket

## 🆘 SOS Flow (Statuses)

Status lifecycle: `PENDING → ACCEPTED → ARRIVED → COMPLETED` (backend is source of truth).

### Client Side

1. Open app → **ClientHomeScreen**
2. Grant location permission
3. Press **SOS Button** (big red button)
4. SOS request sent with current coordinates (status: PENDING)
5. Wait for driver to accept (status: ACCEPTED)
6. Receive alerts:
   - **ARRIVED** → "Ambulance Arrived" (driver picked up patient)
   - **COMPLETED** → "Emergency Completed"
7. Track ambulance on **ClientMapScreen** via WebSocket updates

### Driver Side

1. Open app → **DriverHomeScreen**
2. Toggle **Online** status
3. Receive real-time SOS alerts via WebSocket
4. Accept SOS (status: ACCEPTED)
5. Navigate with **DriverMapScreen**
6. **Patient Picked Up** → calls `/sos/{id}/arrived` (status: ARRIVED)
7. **Complete Emergency** → calls `/sos/{id}/complete` (status: COMPLETED)
8. Screens stay mounted until status = COMPLETED

## 🗺️ Maps Configuration

- Provider: **Google Maps** via `react-native-maps`
- API Key: configured in `app/config/index.ts` and `app.json` (`googleMapsApiKey`)
- Routing/ETA: helpers in `app/utils/location.ts`

## 🔌 WebSocket Integration

- Protocol: STOMP over SockJS (`/ws` endpoint)
- Topics: `/topic/sos` (broadcast) and `/user/{clientId}/topic/sos`
- Source of truth: Backend broadcasts after every status changes
- Frontend state: `SOSContext` listens to WebSocket and updates `activeSOS`

## 🧪 Testing

Use the end-to-end checklist in `STATUS_UPDATE_FIX.md` and `TESTING_QUICK_GUIDE.md` for:

- Full status flow (ACCEPTED → ARRIVED → COMPLETED)
- Real-time location after ARRIVED
- App background/foreground persistence via AsyncStorage
- Error validation for invalid transitions

## 🚨 Common Issues & Solutions

### Cannot connect to backend

- Android Emulator: Use `http://192.168.1.4:8080`
- iOS Simulator: Use `http://192.168.1.4:8080`
- Physical Device: Use your computer's local IP address

### Location permission denied

- Go to device Settings → Apps → Rapid Rescue → Permissions
- Enable Location permission

## 📞 Support

For issues or questions, refer to:

- Expo Documentation: https://docs.expo.dev
- React Navigation: https://reactnavigation.org

---

**Ready to save lives! 🚑**
