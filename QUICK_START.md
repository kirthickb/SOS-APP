# Quick Start Guide - SOS Ambulance Emergency Application

## 🚀 5-Minute Setup

### Step 1: Backend Setup (2 minutes)

```bash
# Navigate to backend
cd sos-backend

# Configure database in src/main/resources/application.properties
# Update these values:
spring.datasource.url=jdbc:mysql://localhost:3306/sos_db?createDatabaseIfNotExist=true
spring.datasource.username=root
spring.datasource.password=your_mysql_password

# Run backend
./mvnw spring-boot:run

# Backend starts on http://localhost:8080
# Wait for "Started SosBackendApplication" message
```

### Step 2: Frontend Setup (3 minutes)

```bash
# Open new terminal
cd sos-app

# All dependencies already installed!
# Just verify:
npm install

# Update backend URL if needed
# Edit src/config/index.ts:
# - Android Emulator: http://10.0.2.2:8080/api (default)
# - iOS Simulator: http://localhost:8080/api
# - Physical Device: http://YOUR_COMPUTER_IP:8080/api

# Start Expo
npx expo start

# Press 'a' for Android or 'i' for iOS
```

### Step 3: Test the App (2 minutes)

#### Test as Client:

1. Press 'a' to open Android emulator
2. App opens → Register
3. Choose role: **CLIENT**
4. Enter: Name, Phone (10 digits), Password
5. Login
6. Press the big red **SOS** button
7. Grant location permission → SOS sent!

#### Test as Driver (use second device/emulator):

1. Open second emulator or device
2. Register with role: **DRIVER**
3. Login
4. Toggle **Online**
5. You'll see SOS alerts in real-time!
6. Press **Accept** on an SOS
7. View navigation map

---

## 🎯 Testing Checklist

### ✅ CLIENT Flow

- [ ] Register as CLIENT
- [ ] Login successfully
- [ ] Fill health profile
- [ ] Press SOS button
- [ ] See "SOS sent successfully" message
- [ ] Navigate to map view

### ✅ DRIVER Flow

- [ ] Register as DRIVER
- [ ] Login successfully
- [ ] Fill driver profile
- [ ] Toggle Online (turns green)
- [ ] Receive SOS alert
- [ ] Accept SOS request
- [ ] View navigation map
- [ ] See route and ETA

### ✅ Real-time WebSocket

- [ ] Run 2 devices/emulators
- [ ] Login CLIENT on device 1
- [ ] Login DRIVER on device 2
- [ ] Driver goes Online
- [ ] Client sends SOS
- [ ] Driver receives alert within 1 second
- [ ] Driver accepts
- [ ] Client sees "SOS Accepted"

---

## 🔧 Troubleshooting

### Problem: "Network Error" or "Cannot connect"

**Solution:**

```typescript
// Edit src/config/index.ts

// For Android Emulator:
BASE_URL: 'http://10.0.2.2:8080/api',

// For iOS Simulator:
BASE_URL: 'http://localhost:8080/api',

// For Physical Device:
// 1. Find your computer's IP: ipconfig (Windows) or ifconfig (Mac/Linux)
// 2. Use: BASE_URL: 'http://192.168.1.X:8080/api',
```

### Problem: "Location permission denied"

**Solution:**

1. On emulator/device: Settings → Apps → SOS App → Permissions
2. Enable Location (Allow all the time or While using app)
3. Restart app

### Problem: WebSocket not connecting

**Solution:**

1. Check backend is running: Open http://localhost:8080/api in browser
2. Check CORS: Backend should show `@CrossOrigin(origins = "*")` in controllers
3. Restart both backend and frontend

### Problem: Maps not showing

**Solution:**

1. Check internet connection (OpenStreetMap needs internet)
2. For Android: Ensure Google Play Services installed in emulator
3. Grant location permission

---

## 📱 Device Configuration

### Android Emulator (Recommended for Testing)

```bash
# Backend URL to use:
http://10.0.2.2:8080/api

# This is a special IP that Android emulator uses to reach localhost
```

### iOS Simulator

```bash
# Backend URL to use:
http://localhost:8080/api

# iOS simulator can directly access localhost
```

### Physical Device

```bash
# Find your computer's IP:
# Windows: Open CMD → ipconfig → Look for "IPv4 Address"
# Mac/Linux: Open Terminal → ifconfig → Look for "inet"

# Example: If your IP is 192.168.1.100
# Backend URL: http://192.168.1.100:8080/api

# IMPORTANT: Your phone and computer must be on the same WiFi network!
```

---

## 🎬 Demo Credentials (For Testing)

After first run, you can use these test accounts:

### Test Client

- Phone: `1234567890`
- Password: `client123`
- Role: CLIENT

### Test Driver

- Phone: `9876543210`
- Password: `driver123`
- Role: DRIVER

_(You need to register these first)_

---

## 📊 Expected Behavior

### When Client Sends SOS:

1. Client presses red SOS button
2. GPS location captured (e.g., lat: 37.7749, lng: -122.4194)
3. API call: `POST /api/client/sos` with location
4. Backend saves SOS with status: `PENDING`
5. Backend broadcasts to WebSocket: `/topic/sos`
6. All online drivers receive alert instantly
7. Client sees "SOS sent successfully" message

### When Driver Accepts SOS:

1. Driver sees SOS in list (e.g., "5.2 km away")
2. Driver presses "Accept" button
3. API call: `POST /api/driver/accept/{sosId}`
4. Backend updates SOS status to `ACCEPTED`
5. Backend assigns driver to SOS
6. Driver navigates to DriverMapScreen
7. Map shows route from driver to patient
8. Client receives notification "SOS Accepted"

---

## 🌐 API Endpoints Being Used

### Authentication

- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Get JWT token

### Client

- `POST /api/client/sos` - Send emergency SOS
- `GET /api/client/profile` - Get health profile
- `POST /api/client/profile` - Update profile

### Driver

- `GET /api/driver/sos` - List pending SOS (sorted by distance)
- `POST /api/driver/accept/{id}` - Accept SOS request
- `PUT /api/driver/location` - Update current location
- `GET /api/driver/profile` - Get driver profile
- `POST /api/driver/profile` - Update profile

### WebSocket

- Connect: `ws://localhost:8080/ws`
- Subscribe: `/topic/sos`
- Message format: `{ id, clientId, latitude, longitude, status, timestamp }`

---

## 🎨 UI Color Scheme

- **Primary Blue**: `#2563EB` (buttons, accents)
- **Success Green**: `#10B981` (online status, success messages)
- **Danger Red**: `#EF4444` (SOS button, urgent alerts)
- **Warning Yellow**: `#F59E0B` (pending status)
- **Gray**: `#6B7280` (secondary text, placeholders)
- **White**: `#FFFFFF` (backgrounds, cards)

---

## ✅ Success Indicators

### Backend Running:

- Terminal shows: `Started SosBackendApplication in X seconds`
- No red error messages
- Port 8080 is listening

### Frontend Running:

- Expo DevTools open in browser
- QR code displayed
- No red errors in Metro bundler

### App Working:

- Can register new user
- Can login successfully
- Can see appropriate home screen (CLIENT or DRIVER)
- SOS button visible (CLIENT) or Online toggle visible (DRIVER)

---

## 🚨 Emergency Stop

If something goes wrong:

```bash
# Stop backend (in backend terminal):
Ctrl + C

# Stop frontend (in frontend terminal):
Ctrl + C

# Restart:
# Terminal 1:
cd sos-backend && ./mvnw spring-boot:run

# Terminal 2:
cd sos-app && npx expo start
```

---

## 📞 Need Help?

### Check Logs:

**Backend logs**: Terminal running `mvnw spring-boot:run`
**Frontend logs**: Metro bundler terminal
**App logs**: Expo DevTools → Logs tab

### Common Error Messages:

1. **"Failed to connect to /10.0.2.2:8080"**

   - Backend is not running → Start backend first

2. **"Request failed with status code 401"**

   - Token expired or invalid → Logout and login again

3. **"Network request failed"**

   - Wrong BASE_URL → Check src/config/index.ts

4. **"Location permission denied"**
   - Grant permission in device settings

---

## 🎉 You're All Set!

If you can:

- ✅ Register as CLIENT
- ✅ Send SOS
- ✅ Register as DRIVER (on second device)
- ✅ Driver receives SOS alert
- ✅ Driver can accept SOS

**Then everything is working perfectly! 🎊**

---

**Happy Testing! 🚑**
