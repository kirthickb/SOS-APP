# Final Testing & Verification Guide

## ✅ Complete Feature Test Suite

### 🎯 Pre-Test Setup

#### Step 1: Verify Backend is Running

```bash
# Check backend health
curl http://localhost:8080/actuator/health
# or visit in browser

# Expected: Should return 200 OK or a health status
```

#### Step 2: Verify Frontend is Running

```bash
cd sos-app
npx expo start

# Press 'a' for Android emulator
# App should open without errors
```

---

## 📋 Test Scenarios

### Scenario 1: CLIENT Registration & Login ✅

**Test Steps:**

1. Open app in emulator/device
2. See Login screen
3. Click "Register" link
4. Fill registration form:
   - Name: `John Doe`
   - Phone: `1234567890` (10 digits)
   - Password: `client123` (min 6 chars)
   - Confirm Password: `client123`
   - Role: Select **CLIENT**
5. Click "Register" button

**Expected Result:**

- ✅ Registration successful
- ✅ Automatically logged in
- ✅ Navigate to ClientHomeScreen
- ✅ See big red SOS button
- ✅ See "Logout" button in header

**Verify Backend:**

```bash
# Check database
mysql -u root -p
USE sos_db;
SELECT * FROM users WHERE phone = '1234567890';
# Should show 1 user with role CLIENT
```

---

### Scenario 2: CLIENT Profile Creation ✅

**Test Steps:**

1. From ClientHomeScreen, click "Profile" tab (bottom)
2. Fill profile form:
   - Age: `28`
   - Gender: Select **Male** or **Female**
   - Blood Group: Select **O+**
   - Address: `123 Main St`
   - City: `San Francisco`
   - State: `California`
   - Relative Name: `Jane Doe`
   - Relative Phone: `9876543210`
   - Medical Notes: `Allergic to penicillin` (optional)
3. Click "Save Profile"

**Expected Result:**

- ✅ "Profile saved successfully" message
- ✅ Form stays filled
- ✅ Can navigate away and come back - data persists

**Verify Backend:**

```bash
# Check database
SELECT * FROM client_profiles WHERE user_id = (SELECT id FROM users WHERE phone = '1234567890');
# Should show profile data
```

---

### Scenario 3: CLIENT Send SOS ✅

**Test Steps:**

1. Go back to "Home" tab
2. Click big red **SOS** button
3. If prompted, grant location permission:
   - Select "Allow while using app" or "Allow"

**Expected Result:**

- ✅ Location permission granted
- ✅ "Sending SOS..." loading indicator appears
- ✅ "SOS sent successfully!" message
- ✅ Navigate to Map screen
- ✅ See marker at your location

**Verify Backend:**

```bash
# Check SOS request created
SELECT * FROM sos_requests ORDER BY created_at DESC LIMIT 1;
# Should show:
# - status: PENDING
# - latitude and longitude populated
# - client_id matches user
```

**Verify WebSocket:**

- Backend console should log: "Broadcasting SOS to /topic/sos"

---

### Scenario 4: DRIVER Registration & Login ✅

**Test Steps:**

1. Open app in SECOND device/emulator (or logout and re-register)
2. Click "Register"
3. Fill registration form:
   - Name: `Mike Driver`
   - Phone: `9876543210`
   - Password: `driver123`
   - Confirm Password: `driver123`
   - Role: Select **DRIVER**
4. Click "Register"

**Expected Result:**

- ✅ Registration successful
- ✅ Navigate to DriverHomeScreen
- ✅ See "Go Online" toggle (gray)
- ✅ See "No SOS requests" message

---

### Scenario 5: DRIVER Profile Creation ✅

**Test Steps:**

1. From DriverHomeScreen, click "Profile" tab
2. Fill profile form:
   - Vehicle Number: `ABC-1234`
   - Service City: `San Francisco`
3. Click "Save Profile"

**Expected Result:**

- ✅ "Profile saved successfully" message
- ✅ Vehicle number displayed in uppercase

**Verify Backend:**

```bash
SELECT * FROM driver_profiles WHERE user_id = (SELECT id FROM users WHERE phone = '9876543210');
# Should show driver profile
```

---

### Scenario 6: DRIVER Goes Online ✅

**Test Steps:**

1. Go back to "Home" tab
2. Toggle "Go Online" switch

**Expected Result:**

- ✅ Toggle turns green
- ✅ Text changes to "You're Online"
- ✅ Location permission requested (grant it)
- ✅ Driver location updated in backend

**Verify Backend:**

```bash
# Check driver location
SELECT latitude, longitude, last_updated FROM driver_profiles
WHERE user_id = (SELECT id FROM users WHERE phone = '9876543210');
# Should show current location and recent timestamp
```

---

### Scenario 7: DRIVER Receives Real-Time SOS Alert ✅

**Prerequisites:**

- CLIENT app on device 1 (online)
- DRIVER app on device 2 (online and toggled "Online")

**Test Steps:**

1. On CLIENT device: Press SOS button
2. On DRIVER device: Wait 1-2 seconds

**Expected Result:**

- ✅ SOS card appears in driver's list instantly (no refresh needed)
- ✅ Shows "Emergency Alert" with red border
- ✅ Shows distance (e.g., "5.2 km away")
- ✅ Shows timestamp
- ✅ Shows "Accept" button

**Verify WebSocket:**

- Driver console should log: "Received SOS via WebSocket"

---

### Scenario 8: DRIVER Accepts SOS ✅

**Test Steps:**

1. On DRIVER device: Click "Accept" button on SOS card

**Expected Result:**

- ✅ Navigate to DriverMapScreen
- ✅ See map with 2 markers:
  - 🚑 Blue ambulance marker (driver location)
  - 📍 Red pin (patient location)
- ✅ See blue route polyline between markers
- ✅ See info card at top:
  - Distance (e.g., "5.2 km")
  - ETA (e.g., "8 min")
- ✅ See "Call Patient" button (green)
- ✅ See "Open Maps" button (blue)

**Verify Backend:**

```bash
# Check SOS status updated
SELECT status, driver_id FROM sos_requests WHERE id = <sos_id>;
# Should show:
# - status: ACCEPTED
# - driver_id: populated with driver's ID
```

---

### Scenario 9: CLIENT Sees SOS Accepted ✅

**Test Steps:**

1. On CLIENT device: Already on ClientMapScreen (from sending SOS)
2. After driver accepts: Wait 2-3 seconds

**Expected Result:**

- ✅ See notification: "SOS Accepted by driver"
- ✅ Map updates to show driver location
- ✅ See route from driver to patient
- ✅ (Optional) See driver info card

---

### Scenario 10: Real-Time Driver Location Updates ✅

**Test Steps:**

1. Keep both apps open
2. On DRIVER device: Move around (or simulate location change in emulator)
3. On CLIENT device: Watch map

**Expected Result:**

- ✅ Driver marker updates position every 30 seconds
- ✅ Route polyline updates
- ✅ Distance and ETA update

---

### Scenario 11: Google Maps Integration ✅

**Test Steps:**

1. On DRIVER device: In DriverMapScreen
2. Click "Open Maps" button

**Expected Result:**

- ✅ Opens Google Maps app (or browser)
- ✅ Shows navigation from driver to patient location
- ✅ User can follow turn-by-turn directions

---

### Scenario 12: Logout & Re-Login ✅

**Test Steps:**

1. On any device: Click "Logout" button
2. Should return to Login screen
3. Login with same credentials:
   - Phone: `1234567890` (or `9876543210` for driver)
   - Password: `client123` (or `driver123`)

**Expected Result:**

- ✅ Login successful
- ✅ Navigate to appropriate home screen based on role
- ✅ Profile data still present (persisted)

---

## 🔍 Error Handling Tests

### Test 13: Invalid Registration ❌ → ✅

**Test Steps:**

1. Try to register with:
   - Phone: `123` (less than 10 digits)

**Expected:**

- ✅ Validation error: "Phone must be 10 digits"

2. Try to register with:
   - Password: `123` (less than 6 chars)

**Expected:**

- ✅ Validation error: "Password must be at least 6 characters"

3. Try to register with:
   - Password: `password123`
   - Confirm: `password456` (mismatch)

**Expected:**

- ✅ Validation error: "Passwords do not match"

---

### Test 14: Invalid Login ❌ → ✅

**Test Steps:**

1. Try to login with wrong phone:
   - Phone: `0000000000`
   - Password: `anything`

**Expected:**

- ✅ Error message: "Invalid credentials"

2. Try to login with wrong password:
   - Phone: `1234567890` (existing user)
   - Password: `wrongpass`

**Expected:**

- ✅ Error message: "Invalid credentials"

---

### Test 15: Location Permission Denied ❌ → ✅

**Test Steps:**

1. As CLIENT, press SOS button
2. When prompted, DENY location permission

**Expected:**

- ✅ Error message: "Location permission is required"
- ✅ App doesn't crash
- ✅ User can retry after granting permission

---

### Test 16: Network Error Handling ❌ → ✅

**Test Steps:**

1. Stop backend server
2. Try to login or send SOS

**Expected:**

- ✅ Error message: "Network error. Please try again."
- ✅ App doesn't crash
- ✅ User can retry after backend restarts

---

## 📊 Performance Tests

### Test 17: WebSocket Latency

**Test Steps:**

1. CLIENT sends SOS
2. Measure time until DRIVER receives alert

**Expected:**

- ✅ Alert received within 1-2 seconds

---

### Test 18: Location Update Frequency

**Test Steps:**

1. DRIVER goes online
2. Check backend logs for location updates

**Expected:**

- ✅ Location updated every 30 seconds (configurable)

---

### Test 19: Map Loading Performance

**Test Steps:**

1. Open DriverMapScreen or ClientMapScreen

**Expected:**

- ✅ Map loads within 2-3 seconds
- ✅ Markers appear immediately
- ✅ Route draws smoothly

---

## 🎯 Integration Tests

### Test 20: Complete End-to-End Flow

**Test Steps:**

1. CLIENT registers → Login → Fill profile → Send SOS
2. DRIVER registers → Login → Fill profile → Go online
3. DRIVER receives alert → Accepts SOS
4. CLIENT sees "Accepted" → Tracks driver
5. DRIVER navigates → Updates location
6. CLIENT sees driver approaching

**Expected:**

- ✅ All steps complete without errors
- ✅ Real-time updates work smoothly
- ✅ No crashes or freezes

---

## ✅ Final Verification Checklist

### Backend ✅

- [ ] Backend running on http://localhost:8080
- [ ] MySQL database connected
- [ ] Users table created
- [ ] Client profiles table created
- [ ] Driver profiles table created
- [ ] SOS requests table created
- [ ] JWT authentication working
- [ ] WebSocket endpoint active at /ws

### Frontend ✅

- [ ] App builds without errors
- [ ] All 9 screens created and accessible
- [ ] Registration works (CLIENT and DRIVER)
- [ ] Login works with JWT
- [ ] Logout clears token
- [ ] CLIENT can send SOS
- [ ] DRIVER receives real-time alerts
- [ ] DRIVER can accept SOS
- [ ] Maps display correctly
- [ ] Location permissions handled
- [ ] Navigation works (React Navigation)
- [ ] Bottom tabs work
- [ ] Loading states show
- [ ] Error messages display

### Real-time Communication ✅

- [ ] WebSocket connects on login
- [ ] WebSocket disconnects on logout
- [ ] SOS alerts broadcast to /topic/sos
- [ ] Drivers receive alerts instantly
- [ ] No duplicate messages
- [ ] Connection stable (no drops)

### Maps & Location ✅

- [ ] OpenStreetMap tiles load
- [ ] Markers display (driver and patient)
- [ ] Polyline route draws
- [ ] Distance calculated correctly
- [ ] ETA displayed
- [ ] GPS location accurate
- [ ] Location updates in real-time

---

## 🐛 Known Issues (If Any)

1. **Issue**: Maps may take 2-3 seconds to load tiles

   - **Workaround**: This is normal due to network latency with OpenStreetMap

2. **Issue**: WebSocket may disconnect on network change

   - **Workaround**: Auto-reconnect implemented in SocketContext

3. **Issue**: Android emulator location may be default (California)
   - **Workaround**: Use emulator extended controls to set custom location

---

## 📞 Troubleshooting Guide

### Problem: "Cannot connect to backend"

**Solution:**

```typescript
// Check src/config/index.ts
BASE_URL: "http://10.0.2.2:8080/api"; // For Android Emulator
// or
BASE_URL: "http://localhost:8080/api"; // For iOS Simulator
```

### Problem: "WebSocket not connecting"

**Solution:**

1. Check backend is running
2. Verify CORS configuration allows WebSocket
3. Check firewall/antivirus not blocking port 8080

### Problem: "Maps not showing"

**Solution:**

1. Check internet connection
2. Verify location permission granted
3. Wait 2-3 seconds for tiles to load

### Problem: "Location permission denied"

**Solution:**

1. Android: Settings → Apps → SOS App → Permissions → Location → Allow
2. iOS: Settings → Privacy → Location Services → SOS App → While Using

---

## 🎉 Test Results Summary

### Expected Test Pass Rate: 100%

All 20 test scenarios should pass successfully if:

- ✅ Backend is running correctly
- ✅ Frontend dependencies installed
- ✅ MySQL database configured
- ✅ Location permissions granted
- ✅ Internet connection available

---

## 📝 Test Report Template

```
Date: ___________
Tester: ___________
Device: ___________
Backend Version: 1.0.0
Frontend Version: 1.0.0

Test Results:
- Scenario 1 (CLIENT Registration): ✅ PASS / ❌ FAIL
- Scenario 2 (CLIENT Profile): ✅ PASS / ❌ FAIL
- Scenario 3 (Send SOS): ✅ PASS / ❌ FAIL
- Scenario 4 (DRIVER Registration): ✅ PASS / ❌ FAIL
- Scenario 5 (DRIVER Profile): ✅ PASS / ❌ FAIL
- Scenario 6 (Go Online): ✅ PASS / ❌ FAIL
- Scenario 7 (Receive Alert): ✅ PASS / ❌ FAIL
- Scenario 8 (Accept SOS): ✅ PASS / ❌ FAIL
- Scenario 9 (Client Notification): ✅ PASS / ❌ FAIL
- Scenario 10 (Location Updates): ✅ PASS / ❌ FAIL
- Scenario 11 (Google Maps): ✅ PASS / ❌ FAIL
- Scenario 12 (Logout/Login): ✅ PASS / ❌ FAIL

Total Pass Rate: ___/12 (___%)

Notes:
_______________________________
_______________________________
_______________________________
```

---

**🚑 Happy Testing! All systems should be operational and ready to save lives!**
