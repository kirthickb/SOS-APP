# Persistent State Management Implementation

## Overview

This document describes the implementation of persistent, global state management for SOS requests and driver acceptance details. These changes ensure that emergency state persists across screen navigation, app backgrounding, and application restart.

## Problem Statement

Previously, the SOS request state and accepted driver state were tied to screen navigation and local component state, which caused:

- Loss of SOS status when navigating between screens
- Loss of driver details when app was backgrounded
- No consistent "SOS ACTIVE" indication across the application
- Inability for users to cancel SOS at any time
- State reset on app restart

## Solution Architecture

### 1. Enhanced SOSContext (`app/context/SOSContext.tsx`)

**Key Features:**

- **Persistent Storage**: Uses AsyncStorage to store SOS state across app restarts
- **Global Access**: Any screen can access active SOS via `useSOSContext()`
- **Driver Details Storage**: Full driver information (ID, name, phone, vehicle) persisted globally
- **Explicit Cancellation**: New `cancelSOS()` method for user-initiated cancellation
- **WebSocket Synchronization**: Real-time updates from backend via WebSocket subscriptions
- **State Restoration**: On app restart, checks backend for active SOS and restores state

**Storage Keys:**

```typescript
- "activeSOS": Full ActiveSOS object with SOS and driver details
- "sosStatus": Current status (PENDING, ACCEPTED, ARRIVED, COMPLETED, CANCELLED)
- "driverInfo": Accepted driver details (name, phone, vehicle, ID)
- "patientPickedUpTime": Timestamp when driver picked up patient
```

**New Interface - ActiveSOS:**

```typescript
interface ActiveSOS extends SOSResponse {
  acceptedDriverId?: number;
  acceptedDriverPhone?: string;
  acceptedDriverName?: string;
  acceptedDriverVehicle?: string;
  acceptedAtTime?: string;
  createdAtTime?: string;
  arrivedAtTime?: string;
}
```

**Context API Methods:**

- `acceptSOS(sosId, driverId, driverPhone, driverName, vehicle)` - Driver accepts SOS
- `markPatientPickedUp()` - Mark when driver picks up patient
- `markSOSCompleted()` - Complete SOS when reaching hospital
- `cancelSOS()` - **NEW**: User-initiated cancellation that clears all state
- `updateSOSFromWebsocket(sosUpdate)` - **NEW**: Handle real-time backend updates

**State Properties:**

- `activeSOS: ActiveSOS | null` - Current active SOS with driver details
- `isLoadingActiveSOS: boolean` - Loading indicator for state restoration
- `isSosActive: boolean` - Convenience flag (true if active SOS exists)

### 2. Enhanced ClientHomeScreen (`app/screens/client/ClientHomeScreen.tsx`)

**New Features:**

**SOS Active Status Banner:**

- Displayed prominently when SOS is active
- Shows current SOS status (PENDING, ACCEPTED, ARRIVED)
- Displays accepted driver's name when available
- Includes cancel button for user-initiated cancellation
- Red theme for high visibility

**Conditional Rendering:**

- SOS button hidden when SOS is already active
- "Track Ambulance" button shown when SOS is active
- Loading banner shown during state restoration
- Instructions hidden when SOS is active

**Cancel Functionality:**

```typescript
const handleCancelSOS = () => {
  Alert.alert(
    "Cancel Emergency SOS",
    "Are you sure you want to cancel the emergency alert?...",
    [
      { text: "Keep SOS", style: "cancel" },
      {
        text: "Cancel SOS",
        style: "destructive",
        onPress: async () => {
          await cancelSOS();
          Alert.alert("SOS Cancelled", "...");
        },
      },
    ]
  );
};
```

**New UI Components:**

- `sosActiveBanner` - Red border, emergency indicator
- `loadingBanner` - Blue theme, shown during state restoration
- `trackButton` - Navigate to map to track ambulance
- `cancelSOSButton` - Red close icon for cancellation

### 3. Enhanced DriverHomeScreen (`app/screens/driver/DriverHomeScreen.tsx`)

**New Features:**

**Accepted SOS Status Banner:**

- Displayed when driver has accepted a SOS
- Shows patient name and current status
- Green theme for positive confirmation
- Navigate button to go to driver map
- Persists across all screen navigation

**UI Components:**

- `acceptedSOSBanner` - Green border, success indicator
- `acceptedSOSContent` - Patient and status information
- `navigateButton` - Quick access to navigation

**Integration:**

```typescript
const { activeSOS, isSosActive } = useSOSContext();

{
  isSosActive && activeSOS && (
    <View style={styles.acceptedSOSBanner}>
      <Text>✅ SOS ACCEPTED</Text>
      <Text>Patient: {activeSOS.clientName}</Text>
      <Text>Status: {activeSOS.status}</Text>
    </View>
  );
}
```

## State Lifecycle

### 1. SOS Creation (Client)

```
User triggers SOS → API creates SOS → Navigate to map
State: NOT stored in SOSContext (only stored after driver accepts)
```

### 2. Driver Acceptance

```
Driver accepts → acceptSOS() called → State stored globally
AsyncStorage keys: activeSOS, sosStatus, driverInfo
State: {
  status: "ACCEPTED",
  acceptedDriverId: ...,
  acceptedDriverName: ...,
  acceptedDriverVehicle: ...
}
```

### 3. Driver Arrival

```
Driver picks up patient → markPatientPickedUp() → Status updated
AsyncStorage: sosStatus = "ARRIVED", patientPickedUpTime
State: { status: "ARRIVED", arrivedAtTime: ... }
```

### 4. Completion

```
Driver reaches hospital → markSOSCompleted() → State cleared
AsyncStorage: All keys removed
State: activeSOS = null
```

### 5. Cancellation (NEW)

```
User cancels → cancelSOS() → State explicitly cleared
AsyncStorage: All keys removed
State: activeSOS = null
Alert: "SOS Cancelled"
```

### 6. App Restart

```
App opens → restoreSOSStateFromStorage() → Checks AsyncStorage
If sosStatus = "ACCEPTED" or "ARRIVED":
  → Fetch latest from backend
  → Merge with local driver details
  → Restore activeSOS state
If sosStatus = "COMPLETED" or "CANCELLED":
  → Clear all state
```

## WebSocket Integration

**Subscription:**

```typescript
useEffect(() => {
  if (!activeSOS) return;

  const unsubscribe = socketService.subscribeToSOS((sos: SOSResponse) => {
    if (sos.id === activeSOS.id) {
      updateSOSFromWebsocket(sos);
    }
  });

  return () => unsubscribe();
}, [activeSOS?.id]);
```

**Update Handler:**

```typescript
const updateSOSFromWebsocket = (sosUpdate: SOSResponse) => {
  // Merge with existing state to preserve driver details
  const updatedSOS = { ...activeSOS, ...sosUpdate };

  setActiveSOS(updatedSOS);
  AsyncStorage.multiSet([...]);

  // Auto-clear if completed/cancelled
  if (sosUpdate.status === "COMPLETED" || sosUpdate.status === "CANCELLED") {
    setTimeout(() => clearActiveSOS(), 2000);
  }
};
```

## AsyncStorage Schema

```typescript
// Storage Key: "activeSOS"
{
  "id": 123,
  "status": "ACCEPTED",
  "latitude": 12.345,
  "longitude": 67.890,
  "clientName": "John Doe",
  "clientPhone": "1234567890",
  "acceptedDriverId": 456,
  "acceptedDriverPhone": "0987654321",
  "acceptedDriverName": "Jane Driver",
  "acceptedDriverVehicle": "AB-1234",
  "acceptedAtTime": "2024-01-15T10:30:00.000Z",
  ...
}

// Storage Key: "sosStatus"
"ACCEPTED" | "ARRIVED" | "PENDING" | "COMPLETED" | "CANCELLED"

// Storage Key: "driverInfo"
{
  "id": 456,
  "phone": "0987654321",
  "name": "Jane Driver",
  "vehicle": "AB-1234"
}

// Storage Key: "patientPickedUpTime"
"2024-01-15T10:45:00.000Z"
```

## User Experience Improvements

### Before (Issues):

❌ SOS status lost on navigation
❌ Driver details disappeared when changing screens
❌ No indication of active SOS on home screen
❌ App restart cleared emergency state
❌ No way to cancel once triggered
❌ State inconsistent across screens

### After (Fixed):

✅ SOS status persists across all navigation
✅ Driver details accessible from any screen
✅ "🚨 SOS ACTIVE" banner on all relevant screens
✅ State restored on app restart (if backend confirms)
✅ User can cancel SOS at any time with confirmation
✅ State synchronized via WebSocket in real-time
✅ Explicit state clearing on completion/cancellation

## Testing Checklist

### Client Flow:

- [ ] Trigger SOS → Banner appears on ClientHomeScreen
- [ ] Navigate to ClientMap → Navigate back → Banner still visible
- [ ] Background app → Reopen → SOS state restored
- [ ] Kill app → Restart → SOS state restored (if backend confirms)
- [ ] Driver accepts → Driver name appears in banner
- [ ] Click cancel → Confirmation dialog → State cleared
- [ ] Track Ambulance button navigates to map

### Driver Flow:

- [ ] Accept SOS → Banner appears on DriverHomeScreen
- [ ] Navigate to DriverMap → Navigate back → Banner still visible
- [ ] Background app → Reopen → Accepted SOS state restored
- [ ] Navigate button works from banner
- [ ] Status updates appear in banner (ARRIVED, etc.)

### Edge Cases:

- [ ] Multiple SOS requests (only one can be active)
- [ ] WebSocket disconnect → Reconnect → State syncs
- [ ] Backend returns 404 for SOS → State cleared locally
- [ ] User cancels while driver en route → Both states cleared
- [ ] App killed during active SOS → State restored on restart

## Backend API Integration

**Required Endpoints:**

- ✅ `POST /sos/${sosId}/accept` - Accept SOS
- ✅ `POST /sos/${sosId}/arrived` - Mark patient picked up
- ✅ `POST /sos/${sosId}/complete` - Complete SOS
- ✅ `GET /sos/${sosId}` - Fetch SOS details
- ⚠️ `POST /sos/${sosId}/cancel` - **NOT YET IMPLEMENTED** (currently just clears local state)

**Note:** Cancel endpoint needs to be added to backend for full functionality.

## Files Modified

1. **app/context/SOSContext.tsx** - Complete rewrite with persistent state
2. **app/screens/client/ClientHomeScreen.tsx** - Added SOS active banner and cancel functionality
3. **app/screens/driver/DriverHomeScreen.tsx** - Added accepted SOS status banner
4. **app/components/ErrorBoundary.tsx** - Fixed unused imports

## Dependencies

No new dependencies added. Uses existing:

- `@react-native-async-storage/async-storage` - Persistent storage
- React Context API - Global state management
- WebSocket (STOMP) - Real-time updates

## Performance Considerations

- AsyncStorage operations are batched using `multiSet` and `multiRemove`
- WebSocket subscriptions cleaned up on unmount to prevent memory leaks
- State updates only trigger re-renders in components using `useSOSContext()`
- Timeouts used for delayed cleanup to allow WebSocket propagation

## Security Considerations

- Driver details stored locally but not sensitive (public info)
- AsyncStorage data is sandboxed per app on mobile
- JWT token still required for all API calls
- State restoration validates with backend before accepting

## Future Enhancements

1. **Backend Cancel Endpoint** - Add proper cancellation support
2. **Push Notifications** - Alert user even when app is closed
3. **Background Location** - Track driver location when app backgrounded
4. **State Encryption** - Encrypt AsyncStorage data for additional security
5. **Multiple SOS Support** - Handle edge case of multiple simultaneous SOS (currently one active at a time)
6. **Offline Queue** - Queue state updates when offline, sync when online

## Conclusion

This implementation ensures that SOS emergency state is treated as a critical, persistent, application-level state that survives all navigation, backgrounding, and restart scenarios. Users now have full visibility and control over their emergency requests at all times.
