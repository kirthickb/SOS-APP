# SOS Ambulance Emergency Application - Frontend

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
- **State Management**: Context API (AuthContext, SocketContext)
- **API Communication**: Axios with JWT interceptors
- **Real-time**: STOMP over SockJS WebSocket
- **Maps**: react-native-maps with OpenStreetMap tiles
- **Location**: expo-location
- **Storage**: AsyncStorage

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

   Edit `src/services/api.ts` and update the `BASE_URL`:

   ```typescript
   // For Android Emulator (default)
   const BASE_URL = "http://10.201.132.18:8080/api";

   // For iOS Simulator
   const BASE_URL = "http://10.201.132.18:8080/api";

   // For Physical Device (replace with your computer's IP)
   const BASE_URL = "http://192.168.1.X:8080/api";
   ```

   Similarly update `src/services/socket.ts`:

   ```typescript
   const SOCKET_URL = "http://10.201.132.18:8080/ws";
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
src/
├── context/
│   ├── AuthContext.tsx          # Authentication state management
│   └── SocketContext.tsx        # WebSocket connection management
├── navigation/
│   ├── AuthNavigator.tsx        # Login/Register navigation
│   └── AppNavigator.tsx         # Role-based navigation (Client/Driver)
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   └── RegisterScreen.tsx
│   ├── client/
│   │   ├── ClientHomeScreen.tsx    # SOS button
│   │   ├── ClientProfileScreen.tsx # Health information
│   │   └── ClientMapScreen.tsx     # Track ambulance
│   └── driver/
│       ├── DriverHomeScreen.tsx    # SOS alerts list
│       ├── DriverProfileScreen.tsx # Vehicle information
│       └── DriverMapScreen.tsx     # Navigation to patient
├── services/
│   ├── api.ts                   # Axios API service with JWT
│   └── socket.ts                # WebSocket service
├── types/
│   └── index.ts                 # TypeScript interfaces
└── utils/
    └── location.ts              # Location utilities
```

## 🔐 Authentication Flow

1. **Register**: Choose role (CLIENT or DRIVER), provide name, phone, password
2. **Login**: Phone number and password
3. **JWT Token**: Stored in AsyncStorage, auto-injected in API requests
4. **Auto-login**: Check saved token on app start
5. **Logout**: Clear token and disconnect WebSocket

## 🆘 SOS Flow

### Client Side:

1. Open app → **ClientHomeScreen**
2. Grant location permission
3. Press **SOS Button** (big red button)
4. SOS request sent with current coordinates
5. Wait for driver to accept
6. Navigate to **ClientMapScreen** to track ambulance

### Driver Side:

1. Open app → **DriverHomeScreen**
2. Toggle **Online** status
3. Receive real-time SOS alerts via WebSocket
4. View SOS list with distance calculation
5. Press **Accept** on an SOS request
6. Navigate to **DriverMapScreen** with turn-by-turn navigation
7. Use **Open Maps** button for Google Maps integration

## 🗺️ Maps Configuration

The app uses **OpenStreetMap** tiles (free, no API key required) and OSRM routing service.

## 🔌 WebSocket Integration

Real-time SOS alerts powered by STOMP over SockJS connecting to backend at `/ws` endpoint.

## 🧪 Testing

### Test as CLIENT:

1. Register with role: **CLIENT**
2. Fill health profile (age, blood group, emergency contact)
3. Go to Home → Press SOS button
4. Grant location permission

### Test as DRIVER:

1. Register with role: **DRIVER**
2. Fill driver profile (vehicle number, service city)
3. Go to Home → Toggle **Online**
4. Accept SOS requests

## 🚨 Common Issues & Solutions

### Cannot connect to backend

- Android Emulator: Use `http://10.201.132.18:8080`
- iOS Simulator: Use `http://10.201.132.18:8080`
- Physical Device: Use your computer's local IP address

### Location permission denied

- Go to device Settings → Apps → SOS App → Permissions
- Enable Location permission

## 📞 Support

For issues or questions, refer to:

- Expo Documentation: https://docs.expo.dev
- React Navigation: https://reactnavigation.org

---

**Ready to save lives! 🚑**
