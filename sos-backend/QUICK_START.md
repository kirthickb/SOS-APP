# Quick Start Guide - SOS Backend

## Prerequisites Checklist

- [ ] Java 17+ installed (`java -version`)
- [ ] Maven installed (`mvn -version`)
- [ ] MySQL 8.x running on localhost:3306
- [ ] MySQL root password set

---

## 🚀 5-Minute Setup

### Step 1: Start MySQL

```bash
# Windows
net start MySQL80

# Linux/Mac
sudo service mysql start
```

### Step 2: Create Database (Optional)

```sql
mysql -u root -p
CREATE DATABASE sos_app_db;
EXIT;
```

_Note: Application will auto-create database if it doesn't exist_

### Step 3: Update Database Password

Edit `src/main/resources/application.properties`:

```properties
spring.datasource.password=YOUR_MYSQL_PASSWORD
```

### Step 4: Build & Run

```bash
cd sos-backend
mvn clean install
mvn spring-boot:run
```

### Step 5: Verify Server

```bash
# Should show: Server started on port 8080
curl http://localhost:8080/api/auth/register
```

---

## 🧪 Test the API (5 Minutes)

### Test 1: Register Client

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"John\",\"phone\":\"1111111111\",\"password\":\"pass123\",\"role\":\"CLIENT\"}"
```

**Expected Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "CLIENT"
}
```

✅ Copy the token - you'll need it!

---

### Test 2: Register Driver

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Mike\",\"phone\":\"2222222222\",\"password\":\"pass123\",\"role\":\"DRIVER\"}"
```

✅ Copy this token too!

---

### Test 3: Create Driver Profile

```bash
# Replace <DRIVER_TOKEN> with actual token
curl -X POST http://localhost:8080/api/driver/profile \
  -H "Authorization: Bearer <DRIVER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"vehicleNumber\":\"AMB123\",\"serviceCity\":\"NYC\"}"
```

---

### Test 4: Set Driver Online

```bash
curl -X POST http://localhost:8080/api/driver/availability \
  -H "Authorization: Bearer <DRIVER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"isAvailable\":true}"
```

---

### Test 5: Update Driver Location

```bash
curl -X POST http://localhost:8080/api/driver/location \
  -H "Authorization: Bearer <DRIVER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"latitude\":40.7128,\"longitude\":-74.0060}"
```

---

### Test 6: Create SOS (Client)

```bash
# Replace <CLIENT_TOKEN> with actual token
curl -X POST http://localhost:8080/api/sos \
  -H "Authorization: Bearer <CLIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"latitude\":40.7130,\"longitude\":-74.0065}"
```

**Expected Response:**

```json
{
  "id": 1,
  "clientName": "John",
  "clientPhone": "1111111111",
  "latitude": 40.713,
  "longitude": -74.0065,
  "status": "PENDING",
  "createdAt": "2026-01-06T10:30:00"
}
```

✅ Copy the `id` from response!

---

### Test 7: Driver Views Nearby SOS

```bash
curl -X GET "http://localhost:8080/api/sos/nearby?lat=40.7128&lng=-74.0060&radius=5" \
  -H "Authorization: Bearer <DRIVER_TOKEN>"
```

---

### Test 8: Driver Accepts SOS

```bash
# Replace <SOS_ID> with actual id
curl -X POST http://localhost:8080/api/sos/<SOS_ID>/accept \
  -H "Authorization: Bearer <DRIVER_TOKEN>"
```

**Expected Response:**

```json
{
  "id": 1,
  "status": "ACCEPTED",
  "acceptedDriverName": "Mike",
  "acceptedDriverPhone": "2222222222"
}
```

---

## 🎉 Success!

If all tests passed, your SOS backend is working perfectly!

---

## 🐛 Common Issues

### Issue: "Connection refused"

**Solution:** Make sure MySQL is running

```bash
net start MySQL80
```

### Issue: "Access denied for user 'root'"

**Solution:** Update password in `application.properties`

### Issue: "Port 8080 already in use"

**Solution:** Change port in `application.properties`:

```properties
server.port=8081
```

### Issue: "JWT token expired"

**Solution:** Register again to get a new token

---

## 📊 Check Database

```sql
mysql -u root -p
USE sos_app_db;

-- View all tables
SHOW TABLES;

-- View users
SELECT * FROM users;

-- View SOS requests
SELECT * FROM sos_requests;

-- View drivers
SELECT * FROM driver_profiles;
```

---

## 🔌 Test WebSocket (Browser Console)

```html
<!DOCTYPE html>
<html>
  <body>
    <script src="https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js"></script>
    <script>
      var socket = new SockJS("http://localhost:8080/ws");
      var stompClient = Stomp.over(socket);

      stompClient.connect({}, function (frame) {
        console.log("✅ Connected to WebSocket");

        stompClient.subscribe("/topic/sos", function (message) {
          console.log("🚨 SOS ALERT:", JSON.parse(message.body));
        });
      });
    </script>
    <h1>WebSocket Test - Check Console</h1>
  </body>
</html>
```

---

## 📝 Next Steps

1. ✅ Backend is running
2. 📱 Connect your React Native frontend
3. 🔔 Test real-time notifications
4. 🚀 Deploy to production (see PRODUCTION_DEPLOYMENT.md)

---

## 🆘 Need Help?

Check these files:

- `README.md` - Full documentation
- `API_TESTING_GUIDE.md` - Detailed API examples
- `PRODUCTION_DEPLOYMENT.md` - Deployment guide

---

**Congratulations! Your SOS Backend is ready!** 🎉
