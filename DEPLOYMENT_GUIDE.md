# Deployment Guide - SOS Ambulance Emergency Application

## 📦 Production Deployment Checklist

### Phase 1: Backend Deployment

#### Option A: Deploy to AWS EC2

1. **Launch EC2 Instance**

   ```bash
   # Amazon Linux 2 or Ubuntu 20.04
   # Instance type: t2.medium (minimum)
   # Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 8080 (API)
   ```

2. **Install Java & MySQL**

   ```bash
   # Update system
   sudo yum update -y  # For Amazon Linux
   # or
   sudo apt update && sudo apt upgrade -y  # For Ubuntu

   # Install Java 17
   sudo yum install java-17-amazon-corretto -y
   # or
   sudo apt install openjdk-17-jdk -y

   # Install MySQL
   sudo yum install mysql-server -y
   # or
   sudo apt install mysql-server -y

   # Start MySQL
   sudo systemctl start mysqld
   sudo systemctl enable mysqld
   ```

3. **Configure MySQL**

   ```bash
   # Secure installation
   sudo mysql_secure_installation

   # Create database
   mysql -u root -p
   CREATE DATABASE sos_db;
   CREATE USER 'sosadmin'@'localhost' IDENTIFIED BY 'strong_password_here';
   GRANT ALL PRIVILEGES ON sos_db.* TO 'sosadmin'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

4. **Deploy Backend**

   ```bash
   # Upload JAR file to EC2
   scp -i your-key.pem target/sos-backend.jar ec2-user@your-ec2-ip:/home/ec2-user/

   # SSH into EC2
   ssh -i your-key.pem ec2-user@your-ec2-ip

   # Update application.properties for production
   vi application.properties
   # Set:
   # - spring.datasource.url (MySQL on EC2)
   # - jwt.secret (strong secret)
   # - server.port=8080

   # Run as service
   sudo vi /etc/systemd/system/sos-backend.service
   ```

5. **Create Service File**

   ```ini
   [Unit]
   Description=SOS Backend Service
   After=syslog.target network.target

   [Service]
   User=ec2-user
   ExecStart=/usr/bin/java -jar /home/ec2-user/sos-backend.jar
   SuccessExitStatus=143
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

6. **Start Service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start sos-backend
   sudo systemctl enable sos-backend
   sudo systemctl status sos-backend
   ```

#### Option B: Deploy to Heroku

1. **Install Heroku CLI**

   ```bash
   npm install -g heroku
   heroku login
   ```

2. **Create Heroku App**

   ```bash
   cd sos-backend
   heroku create sos-ambulance-backend

   # Add MySQL addon
   heroku addons:create jawsdb:kitefin
   ```

3. **Configure Environment**

   ```bash
   heroku config:set JWT_SECRET=your_strong_secret
   heroku config:set SPRING_PROFILES_ACTIVE=production
   ```

4. **Deploy**
   ```bash
   git init
   git add .
   git commit -m "Initial backend"
   git push heroku main
   ```

#### Option C: Docker Deployment

1. **Create Dockerfile** (Backend)

   ```dockerfile
   FROM openjdk:17-jdk-slim
   WORKDIR /app
   COPY target/sos-backend.jar app.jar
   EXPOSE 8080
   ENTRYPOINT ["java", "-jar", "app.jar"]
   ```

2. **Create docker-compose.yml**

   ```yaml
   version: "3.8"
   services:
     mysql:
       image: mysql:8.0
       environment:
         MYSQL_DATABASE: sos_db
         MYSQL_ROOT_PASSWORD: root_password
         MYSQL_USER: sosadmin
         MYSQL_PASSWORD: sos_password
       ports:
         - "3306:3306"
       volumes:
         - mysql_data:/var/lib/mysql

     backend:
       build: ./sos-backend
       ports:
         - "8080:8080"
       environment:
         SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/sos_db
         SPRING_DATASOURCE_USERNAME: sosadmin
         SPRING_DATASOURCE_PASSWORD: sos_password
       depends_on:
         - mysql

   volumes:
     mysql_data:
   ```

3. **Deploy**
   ```bash
   docker-compose up -d
   ```

---

### Phase 2: Frontend Deployment

#### Option A: Build APK for Android

1. **Install EAS CLI**

   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Configure EAS**

   ```bash
   cd sos-app
   eas build:configure
   ```

3. **Update Production Config**

   ```typescript
   // src/config/index.ts
   export const API_CONFIG = {
     BASE_URL: "https://your-backend-domain.com/api",
     SOCKET_URL: "https://your-backend-domain.com/ws",
     TIMEOUT: 10000,
   };
   ```

4. **Build APK**

   ```bash
   # For development testing
   eas build --platform android --profile development

   # For production
   eas build --platform android --profile production

   # Download APK from Expo dashboard
   ```

5. **Test APK**
   - Download APK to Android device
   - Install APK
   - Test all features
   - Verify backend connection

#### Option B: Publish to Google Play Store

1. **Create Google Play Console Account**

   - Go to https://play.google.com/console
   - Pay $25 one-time registration fee
   - Create new app

2. **Generate Keystore**

   ```bash
   keytool -genkey -v -keystore sos-release-key.jks -alias sos-app -keyalg RSA -keysize 2048 -validity 10000
   ```

3. **Update eas.json**

   ```json
   {
     "build": {
       "production": {
         "android": {
           "buildType": "app-bundle",
           "credentialsSource": "local"
         }
       }
     }
   }
   ```

4. **Build AAB (App Bundle)**

   ```bash
   eas build --platform android --profile production
   ```

5. **Upload to Play Store**
   - Download AAB from Expo
   - Upload to Play Console
   - Fill app details, screenshots, description
   - Submit for review

#### Option C: Build for iOS

1. **Requirements**

   - Apple Developer Account ($99/year)
   - Mac computer (for local builds)

2. **Configure iOS**

   ```bash
   eas build:configure
   ```

3. **Build IPA**

   ```bash
   # For development
   eas build --platform ios --profile development

   # For production
   eas build --platform ios --profile production
   ```

4. **Submit to App Store**
   ```bash
   eas submit --platform ios
   ```

---

### Phase 3: SSL/HTTPS Setup

#### For Backend (AWS EC2)

1. **Install Nginx**

   ```bash
   sudo yum install nginx -y
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

2. **Install Certbot**

   ```bash
   sudo yum install certbot python3-certbot-nginx -y
   ```

3. **Get SSL Certificate**

   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

4. **Configure Nginx**

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl;
       server_name your-domain.com;

       ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }

       location /ws {
           proxy_pass http://localhost:8080/ws;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

5. **Restart Nginx**
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

### Phase 4: Production Configuration

#### Backend Production Settings

**application-prod.properties**

```properties
# Database
spring.datasource.url=jdbc:mysql://your-rds-endpoint:3306/sos_db
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}

# JPA
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false

# JWT
jwt.secret=${JWT_SECRET}
jwt.expiration=86400000

# CORS (Update with your frontend domain)
cors.allowed-origins=https://your-frontend-domain.com

# Logging
logging.level.root=INFO
logging.level.com.sos=DEBUG

# Server
server.port=8080
server.compression.enabled=true
```

#### Frontend Production Config

**src/config/index.ts**

```typescript
export const API_CONFIG = {
  BASE_URL:
    process.env.EXPO_PUBLIC_API_URL || "https://api.sos-ambulance.com/api",
  SOCKET_URL:
    process.env.EXPO_PUBLIC_WS_URL || "https://api.sos-ambulance.com/ws",
  TIMEOUT: 15000,
};
```

**app.json**

```json
{
  "expo": {
    "name": "SOS Ambulance",
    "slug": "sos-ambulance",
    "version": "1.0.0",
    "icon": "./assets/images/icon.png",
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

---

### Phase 5: Monitoring & Logging

#### Backend Monitoring

1. **Spring Boot Actuator**

   ```xml
   <dependency>
       <groupId>org.springframework.boot</groupId>
       <artifactId>spring-boot-starter-actuator</artifactId>
   </dependency>
   ```

2. **Configure Endpoints**

   ```properties
   management.endpoints.web.exposure.include=health,info,metrics
   management.endpoint.health.show-details=always
   ```

3. **Health Check URL**
   ```
   https://your-domain.com/actuator/health
   ```

#### Frontend Error Tracking

1. **Install Sentry (Optional)**

   ```bash
   npx expo install sentry-expo
   ```

2. **Configure Sentry**

   ```typescript
   import * as Sentry from "sentry-expo";

   Sentry.init({
     dsn: "your-sentry-dsn",
     enableInExpoDevelopment: false,
     debug: false,
   });
   ```

---

### Phase 6: Database Backups

#### Automated MySQL Backup

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ec2-user/backups"
DB_NAME="sos_db"
DB_USER="sosadmin"
DB_PASS="your_password"

mkdir -p $BACKUP_DIR

mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/sos_db_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "sos_db_*.sql" -mtime +7 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/sos_db_$DATE.sql s3://your-bucket/backups/
```

**Add to Crontab**

```bash
crontab -e
# Add: Run daily at 2 AM
0 2 * * * /home/ec2-user/backup.sh
```

---

### Phase 7: Security Hardening

#### Backend Security

1. **Update CORS**

   ```java
   @Configuration
   public class CorsConfig {
       @Bean
       public WebMvcConfigurer corsConfigurer() {
           return new WebMvcConfigurer() {
               @Override
               public void addCorsMappings(CorsRegistry registry) {
                   registry.addMapping("/**")
                       .allowedOrigins("https://your-frontend-domain.com")
                       .allowedMethods("GET", "POST", "PUT", "DELETE")
                       .allowCredentials(true);
               }
           };
       }
   }
   ```

2. **Rate Limiting**

   ```java
   // Add Spring Rate Limiter dependency
   // Implement rate limiting on API endpoints
   ```

3. **SQL Injection Protection**
   - Already using JPA (safe)
   - Use parameterized queries

#### Frontend Security

1. **Store Sensitive Data Securely**

   ```typescript
   // Use Expo SecureStore for tokens
   import * as SecureStore from "expo-secure-store";

   await SecureStore.setItemAsync("jwt_token", token);
   const token = await SecureStore.getItemAsync("jwt_token");
   ```

2. **Validate All Inputs**
   - Already implemented in forms
   - Add more robust validation if needed

---

### Phase 8: Testing in Production

#### Post-Deployment Tests

1. **Backend Health Check**

   ```bash
   curl https://your-domain.com/actuator/health
   # Should return: {"status":"UP"}
   ```

2. **API Test**

   ```bash
   # Register
   curl -X POST https://your-domain.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","phone":"1234567890","password":"test123","role":"CLIENT"}'

   # Login
   curl -X POST https://your-domain.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"phone":"1234567890","password":"test123"}'
   ```

3. **WebSocket Test**

   - Use online WebSocket tester
   - Connect to: `wss://your-domain.com/ws`
   - Subscribe to: `/topic/sos`

4. **Mobile App Test**
   - Install APK on device
   - Test complete CLIENT flow
   - Test complete DRIVER flow
   - Test real-time WebSocket
   - Test maps and navigation

---

## 📊 Deployment Costs Estimate

### AWS Deployment

- **EC2 t2.medium**: ~$30/month
- **RDS MySQL**: ~$25/month
- **Domain**: ~$12/year
- **SSL**: Free (Let's Encrypt)
- **Total**: ~$55/month

### Heroku Deployment

- **Hobby Dyno**: $7/month
- **JawsDB MySQL**: $10/month
- **Total**: ~$17/month

### App Stores

- **Google Play**: $25 one-time
- **Apple App Store**: $99/year

---

## ✅ Production Checklist

- [ ] Backend deployed and running
- [ ] Database migrated and backed up
- [ ] SSL certificate installed
- [ ] CORS configured for production domain
- [ ] JWT secret changed (strong secret)
- [ ] Environment variables secured
- [ ] Health check endpoint accessible
- [ ] API endpoints tested
- [ ] WebSocket tested
- [ ] Frontend APK built
- [ ] App tested on real devices
- [ ] Maps working (OpenStreetMap)
- [ ] Location permissions granted
- [ ] Real-time alerts working
- [ ] Backup system configured
- [ ] Monitoring set up
- [ ] Error tracking configured
- [ ] Play Store listing created (if publishing)

---

## 🎉 Deployment Complete!

Your SOS Ambulance Emergency Application is now live in production!

**Backend URL**: `https://your-domain.com/api`
**WebSocket URL**: `wss://your-domain.com/ws`
**Mobile App**: Available on Google Play (or distributed as APK)

---

**🚑 Ready to save lives in production!**
