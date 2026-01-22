# API Testing Guide - SOS Backend

## Quick Test Flow

### 1. Register Client

```bash
POST http://localhost:8080/api/auth/register
Content-Type: application/json

{
  "name": "John Client",
  "phone": "1111111111",
  "password": "pass123",
  "role": "CLIENT"
}
```

Save the returned `token` as `CLIENT_TOKEN`

---

### 2. Register Driver

```bash
POST http://localhost:8080/api/auth/register
Content-Type: application/json

{
  "name": "Mike Driver",
  "phone": "2222222222",
  "password": "pass123",
  "role": "DRIVER"
}
```

Save the returned `token` as `DRIVER_TOKEN`

---

### 3. Create Client Profile

```bash
POST http://localhost:8080/api/client/profile
Authorization: Bearer {CLIENT_TOKEN}
Content-Type: application/json

{
  "age": 30,
  "gender": "Male",
  "bloodGroup": "O+",
  "address": "123 Main Street, Apt 4B",
  "city": "New York",
  "state": "NY",
  "relativeName": "Jane Doe",
  "relativePhone": "9876543210",
  "medicalNotes": "Diabetic, allergic to penicillin"
}
```

---

### 4. Create Driver Profile

```bash
POST http://localhost:8080/api/driver/profile
Authorization: Bearer {DRIVER_TOKEN}
Content-Type: application/json

{
  "vehicleNumber": "NY-AMB-1234",
  "serviceCity": "New York"
}
```

---

### 5. Set Driver Available

```bash
POST http://localhost:8080/api/driver/availability
Authorization: Bearer {DRIVER_TOKEN}
Content-Type: application/json

{
  "isAvailable": true
}
```

---

### 6. Update Driver Location

```bash
POST http://localhost:8080/api/driver/location
Authorization: Bearer {DRIVER_TOKEN}
Content-Type: application/json

{
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

---

### 7. Client Creates SOS

```bash
POST http://localhost:8080/api/sos
Authorization: Bearer {CLIENT_TOKEN}
Content-Type: application/json

{
  "latitude": 40.7130,
  "longitude": -74.0065
}
```

Save the returned `id` as `SOS_ID`

---

### 8. Driver Views Nearby SOS

```bash
GET http://localhost:8080/api/sos/nearby?lat=40.7128&lng=-74.0060&radius=5
Authorization: Bearer {DRIVER_TOKEN}
```

---

### 9. Driver Accepts SOS

```bash
POST http://localhost:8080/api/sos/{SOS_ID}/accept
Authorization: Bearer {DRIVER_TOKEN}
```

---

## Expected Responses

### Successful Registration/Login

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "CLIENT"
}
```

### SOS Created

```json
{
  "id": 1,
  "clientName": "John Client",
  "clientPhone": "1111111111",
  "latitude": 40.713,
  "longitude": -74.0065,
  "status": "PENDING",
  "acceptedDriverName": null,
  "acceptedDriverPhone": null,
  "createdAt": "2026-01-06T10:30:00"
}
```

### SOS Accepted

```json
{
  "id": 1,
  "clientName": "John Client",
  "clientPhone": "1111111111",
  "latitude": 40.713,
  "longitude": -74.0065,
  "status": "ACCEPTED",
  "acceptedDriverName": "Mike Driver",
  "acceptedDriverPhone": "2222222222",
  "createdAt": "2026-01-06T10:30:00"
}
```

---

## Common Errors

### 401 Unauthorized

- Missing or invalid JWT token
- Token expired (24 hours)

### 403 Forbidden

- Wrong role trying to access endpoint
- CLIENT trying to accept SOS
- DRIVER trying to create SOS

### 400 Bad Request

- Missing required fields
- Invalid data format

### 409 Conflict

- Phone number already registered
- SOS already accepted

---

## WebSocket Testing (JavaScript)

```javascript
const socket = new SockJS("http://localhost:8080/ws");
const stompClient = Stomp.over(socket);

stompClient.connect({}, function (frame) {
  console.log("WebSocket Connected");

  stompClient.subscribe("/topic/sos", function (message) {
    const sosData = JSON.parse(message.body);
    console.log("🚨 NEW SOS ALERT:", sosData);
    // Show notification to driver
  });
});
```

---

## Testing Race Condition Prevention

1. Register 2 drivers (DRIVER1, DRIVER2)
2. Set both as available with same location
3. Create SOS from client
4. Both drivers see the SOS
5. Try accepting from both simultaneously
6. **Expected:** Only first one succeeds, second gets error

---

## Database Verification

After running tests, check MySQL:

```sql
USE sos_app_db;

-- View all users
SELECT * FROM users;

-- View all SOS requests
SELECT * FROM sos_requests;

-- View available drivers
SELECT u.name, dp.*
FROM driver_profiles dp
JOIN users u ON dp.user_id = u.id
WHERE dp.is_available = true;

-- View pending SOS
SELECT sr.*, u.name as client_name
FROM sos_requests sr
JOIN users u ON sr.client_id = u.id
WHERE sr.status = 'PENDING';
```
