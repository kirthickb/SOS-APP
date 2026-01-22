# SOS Ambulance Emergency Backend

A production-ready Spring Boot backend for an SOS ambulance emergency application with real-time WebSocket notifications, JWT authentication, and MySQL database.

## 🚀 Features

- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Role-based Access Control** - CLIENT and DRIVER roles
- ✅ **Real-time Notifications** - WebSocket (STOMP) for instant SOS broadcasts
- ✅ **Geolocation Services** - Haversine formula for nearby driver/SOS search
- ✅ **Transaction Safety** - Prevents race conditions in SOS acceptance
- ✅ **BCrypt Password Encryption**
- ✅ **RESTful API Design**

## 🛠️ Tech Stack

- **Java 17+**
- **Spring Boot 4.0.1**
- **Spring Data JPA**
- **Spring Security**
- **JWT (JJWT 0.12.3)**
- **MySQL 8.x**
- **WebSocket (STOMP)**
- **Maven**
- **Lombok**

## 📁 Project Structure

```
com.sos
├── config/              # Security and WebSocket configuration
├── controller/          # REST API endpoints
├── dto/                 # Data Transfer Objects
├── entity/              # JPA entities
├── repository/          # Database repositories
├── security/            # JWT and authentication logic
├── service/             # Business logic
└── websocket/           # WebSocket configuration
```

## 🗄️ Database Schema

### Tables Created Automatically (JPA)

1. **users** - Authentication base table
2. **client_profiles** - Client health and emergency contact info
3. **driver_profiles** - Ambulance driver details and location
4. **sos_requests** - Emergency requests tracking

## 🔧 Setup & Installation

### Prerequisites

1. **Java 17+** installed
2. **MySQL 8.x** running on `localhost:3306`
3. **Maven** installed

### Step 1: Configure MySQL

Create a MySQL database or let the application create it automatically:

```sql
CREATE DATABASE sos_app_db;
```

**OR** use the auto-create feature (already configured in application.properties)

### Step 2: Update Database Credentials

Edit `src/main/resources/application.properties`:

```properties
spring.datasource.username=root
spring.datasource.password=YOUR_PASSWORD
```

### Step 3: Build the Project

```bash
cd sos-backend
mvn clean install
```

### Step 4: Run the Application

```bash
mvn spring-boot:run
```

The server will start on `http://localhost:8080`

## 🔐 Authentication

All endpoints (except `/api/auth/**` and `/ws/**`) require JWT authentication.

### Headers Required

```
Authorization: Bearer <JWT_TOKEN>
```

## 📡 API Endpoints

### 🔑 Authentication APIs

#### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "1234567890",
  "password": "password123",
  "role": "CLIENT"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "CLIENT"
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "phone": "1234567890",
  "password": "password123"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "CLIENT"
}
```

---

### 👤 Client APIs (CLIENT Role Required)

#### Create/Update Client Profile

```http
POST /api/client/profile
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "age": 30,
  "gender": "Male",
  "bloodGroup": "O+",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "relativeName": "Jane Doe",
  "relativePhone": "9876543210",
  "medicalNotes": "Diabetic"
}
```

#### Get Client Profile

```http
GET /api/client/profile
Authorization: Bearer <TOKEN>
```

---

### 🚑 Driver APIs (DRIVER Role Required)

#### Create/Update Driver Profile

```http
POST /api/driver/profile
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "vehicleNumber": "ABC123",
  "serviceCity": "New York"
}
```

#### Get Driver Profile

```http
GET /api/driver/profile
Authorization: Bearer <TOKEN>
```

#### Update Availability

```http
POST /api/driver/availability
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "isAvailable": true
}
```

#### Update Location

```http
POST /api/driver/location
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

---

### 🚨 SOS APIs

#### Create SOS Request (CLIENT Only)

```http
POST /api/sos
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

**Response:**

```json
{
  "id": 1,
  "clientName": "John Doe",
  "clientPhone": "1234567890",
  "latitude": 40.7128,
  "longitude": -74.006,
  "status": "PENDING",
  "acceptedDriverName": null,
  "acceptedDriverPhone": null,
  "createdAt": "2026-01-06T10:30:00"
}
```

> **Note:** This automatically broadcasts the SOS to all available drivers via WebSocket.

#### Get Nearby SOS Requests (DRIVER Only)

```http
GET /api/sos/nearby?lat=40.7128&lng=-74.0060&radius=5
Authorization: Bearer <TOKEN>
```

**Query Parameters:**

- `lat` - Driver's latitude
- `lng` - Driver's longitude
- `radius` - Search radius in kilometers (default: 5)

#### Accept SOS Request (DRIVER Only)

```http
POST /api/sos/1/accept
Authorization: Bearer <TOKEN>
```

> **Note:** Uses `@Transactional` to prevent race conditions - only the first driver can accept.

---

## 🔌 WebSocket Connection

### Connect to WebSocket

```javascript
const socket = new SockJS("http://localhost:8080/ws");
const stompClient = Stomp.over(socket);

stompClient.connect({}, function (frame) {
  console.log("Connected: " + frame);

  // Subscribe to SOS broadcasts
  stompClient.subscribe("/topic/sos", function (message) {
    const sos = JSON.parse(message.body);
    console.log("New SOS:", sos);
  });
});
```

### Topic

- **Endpoint:** `/ws`
- **Topic:** `/topic/sos`
- **Message Format:** `SOSResponse` JSON

---

## ⚠️ Business Rules

1. ✅ Only **ONLINE drivers** (isAvailable=true) receive SOS alerts
2. ✅ Once SOS is **ACCEPTED**, status changes and other drivers cannot accept it
3. ✅ **Race condition prevention** using `@Transactional` on acceptance
4. ✅ **Geolocation search** uses Haversine formula for accurate distance calculation
5. ✅ Passwords are **hashed** using BCrypt before storage
6. ✅ JWT tokens expire after **24 hours** (configurable)

---

## 🧪 Testing the Application

### 1. Register a Client

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Client",
    "phone": "1111111111",
    "password": "pass123",
    "role": "CLIENT"
  }'
```

### 2. Register a Driver

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mike Driver",
    "phone": "2222222222",
    "password": "pass123",
    "role": "DRIVER"
  }'
```

### 3. Set Driver Online

```bash
curl -X POST http://localhost:8080/api/driver/availability \
  -H "Authorization: Bearer <DRIVER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"isAvailable": true}'
```

### 4. Update Driver Location

```bash
curl -X POST http://localhost:8080/api/driver/location \
  -H "Authorization: Bearer <DRIVER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060
  }'
```

### 5. Create SOS (Client)

```bash
curl -X POST http://localhost:8080/api/sos \
  -H "Authorization: Bearer <CLIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060
  }'
```

---

## 🔒 Security Configuration

### Public Endpoints

- `/api/auth/**` - Registration and login
- `/ws/**` - WebSocket connection

### Protected Endpoints

- `/api/client/**` - Requires `ROLE_CLIENT`
- `/api/driver/**` - Requires `ROLE_DRIVER`
- `/api/sos/**` - Requires authentication (role-specific logic in service)

### JWT Configuration

- **Secret Key:** Configured in `application.properties`
- **Expiration:** 24 hours (86400000 ms)
- **Algorithm:** HS256

---

## 📊 Database Relationships

```
User (1) <---> (1) ClientProfile
User (1) <---> (1) DriverProfile
User (1) <---> (N) SOSRequest (as client)
User (1) <---> (N) SOSRequest (as acceptedDriver)
```

---

## 🐛 Troubleshooting

### Issue: "Access Denied" or 403 Error

**Solution:** Ensure JWT token is included in Authorization header with "Bearer " prefix.

### Issue: WebSocket Connection Failed

**Solution:** Check if CORS is properly configured. Update `WebSocketConfig` if needed.

### Issue: Database Connection Error

**Solution:** Verify MySQL is running and credentials in `application.properties` are correct.

### Issue: "Phone number already exists"

**Solution:** Use a different phone number for registration.

---

## 📝 License

This project is open-source and available for educational purposes.

---

## 👨‍💻 Developer Notes

- All passwords are encrypted using **BCrypt**
- JWT secret should be changed in production (use environment variables)
- Database credentials should use environment variables in production
- WebSocket uses **STOMP** protocol over **SockJS**
- Geolocation calculations use **Haversine formula** for accuracy
- All API responses follow consistent JSON structure

---

## 🚀 Production Deployment Checklist

- [ ] Change JWT secret to a strong random key
- [ ] Use environment variables for sensitive data
- [ ] Enable HTTPS
- [ ] Configure proper CORS settings
- [ ] Set up database backups
- [ ] Enable logging and monitoring
- [ ] Configure rate limiting
- [ ] Set up load balancing (if needed)
- [ ] Use connection pooling for database
- [ ] Enable Spring Boot Actuator for health checks

---

**Built with ❤️ using Spring Boot**
