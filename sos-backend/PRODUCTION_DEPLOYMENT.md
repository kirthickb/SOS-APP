# Production Deployment Guide

## Environment Variables Configuration

Instead of hardcoding values in `application.properties`, use environment variables:

### application.properties (Production)

```properties
spring.application.name=sos-backend
server.port=${PORT:8080}

# Database
spring.datasource.url=${DB_URL}
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# JPA
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.MySQLDialect

# JWT
jwt.secret=${JWT_SECRET}
jwt.expiration=${JWT_EXPIRATION:86400000}

# WebSocket
spring.websocket.allowed-origins=${ALLOWED_ORIGINS:*}
```

### Environment Variables to Set

```bash
# Database
export DB_URL="jdbc:mysql://your-db-host:3306/sos_app_db"
export DB_USERNAME="your_db_user"
export DB_PASSWORD="your_secure_password"

# JWT
export JWT_SECRET="your_base64_encoded_secret_key_at_least_256_bits"
export JWT_EXPIRATION="86400000"

# CORS
export ALLOWED_ORIGINS="https://your-frontend-domain.com"
```

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM openjdk:17-jdk-slim
WORKDIR /app
COPY target/sos-backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  mysql:
    image: mysql:8.0
    container_name: sos-mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: sos_app_db
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - sos-network

  backend:
    build: .
    container_name: sos-backend
    depends_on:
      - mysql
    environment:
      DB_URL: jdbc:mysql://mysql:3306/sos_app_db
      DB_USERNAME: root
      DB_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8080:8080"
    networks:
      - sos-network

volumes:
  mysql_data:

networks:
  sos-network:
    driver: bridge
```

### Build and Run

```bash
# Build JAR
mvn clean package -DskipTests

# Build Docker image
docker build -t sos-backend .

# Run with docker-compose
docker-compose up -d
```

---

## AWS Deployment (Elastic Beanstalk)

### 1. Package Application

```bash
mvn clean package -DskipTests
```

### 2. Create Elastic Beanstalk Application

```bash
eb init -p java-17 sos-backend --region us-east-1
```

### 3. Set Environment Variables

```bash
eb setenv DB_URL="jdbc:mysql://your-rds-endpoint:3306/sos_app_db" \
  DB_USERNAME="admin" \
  DB_PASSWORD="your_password" \
  JWT_SECRET="your_secret"
```

### 4. Deploy

```bash
eb create sos-backend-prod
eb deploy
```

---

## Heroku Deployment

### 1. Create Heroku App

```bash
heroku create sos-backend-prod
```

### 2. Add MySQL Database

```bash
heroku addons:create jawsdb:kitefin
```

### 3. Set Config Vars

```bash
heroku config:set JWT_SECRET="your_secret"
heroku config:set JWT_EXPIRATION="86400000"
```

### 4. Deploy

```bash
git push heroku main
```

---

## Production Security Checklist

### ✅ Must Do

1. **Change JWT Secret**

   - Generate strong random key: `openssl rand -base64 64`
   - Store as environment variable

2. **Enable HTTPS**

   - Use SSL/TLS certificates
   - Force HTTPS redirects

3. **Update CORS Configuration**

   ```java
   @Override
   public void addCorsMappings(CorsRegistry registry) {
       registry.addMapping("/**")
           .allowedOrigins("https://your-frontend.com")
           .allowedMethods("GET", "POST", "PUT", "DELETE")
           .allowedHeaders("*")
           .allowCredentials(true);
   }
   ```

4. **Database Security**

   - Use strong passwords
   - Enable SSL connections
   - Restrict IP access
   - Regular backups

5. **Rate Limiting**

   - Add Spring Boot rate limiter
   - Prevent brute force attacks

6. **Logging & Monitoring**

   - Configure proper logging levels
   - Use ELK stack or CloudWatch
   - Set up alerts

7. **Change Hibernate DDL**

   ```properties
   spring.jpa.hibernate.ddl-auto=validate
   ```

   - Use Flyway or Liquibase for migrations

8. **API Documentation**
   - Add Swagger/OpenAPI
   - Document all endpoints

---

## Performance Optimization

### Database Indexing

```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_user_phone ON users(phone);
CREATE INDEX idx_sos_status ON sos_requests(status);
CREATE INDEX idx_sos_location ON sos_requests(latitude, longitude);
CREATE INDEX idx_driver_location ON driver_profiles(current_latitude, current_longitude);
```

### Connection Pooling

```properties
# HikariCP Configuration
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
```

### Caching

Add Spring Cache for frequently accessed data:

```java
@Cacheable("drivers")
public List<DriverProfile> getAvailableDrivers() {
    // ...
}
```

---

## Monitoring & Health Checks

### Enable Spring Boot Actuator

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

```properties
management.endpoints.web.exposure.include=health,info,metrics
management.endpoint.health.show-details=always
```

### Health Check Endpoints

- `GET /actuator/health` - Application health
- `GET /actuator/metrics` - Performance metrics
- `GET /actuator/info` - Application info

---

## Backup Strategy

### Database Backups

```bash
# Daily backup cron job
0 2 * * * mysqldump -u root -p sos_app_db > /backups/sos_$(date +\%Y\%m\%d).sql
```

### Application Logs

- Rotate logs daily
- Keep last 30 days
- Archive to S3/Cloud Storage

---

## Load Testing

Use Apache JMeter or Gatling:

```bash
# Example with Apache Bench
ab -n 1000 -c 100 http://localhost:8080/api/sos/nearby?lat=40.7128&lng=-74.0060
```

---

## Troubleshooting Production Issues

### High CPU Usage

- Check database queries (N+1 problem)
- Enable query logging
- Add database indexes

### Memory Leaks

- Monitor heap dumps
- Use JProfiler or VisualVM
- Check for unclosed connections

### Slow API Response

- Add caching
- Optimize database queries
- Use async operations where possible

---

## Maintenance Mode

Create a maintenance controller:

```java
@RestController
public class MaintenanceController {

    @Value("${maintenance.mode:false}")
    private boolean maintenanceMode;

    @GetMapping("/api/**")
    public ResponseEntity<?> checkMaintenance() {
        if (maintenanceMode) {
            return ResponseEntity.status(503)
                .body("System under maintenance");
        }
        return null;
    }
}
```

---

**Remember:** Always test changes in a staging environment before deploying to production!
