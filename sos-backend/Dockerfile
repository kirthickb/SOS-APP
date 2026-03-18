# Build stage
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Copy pom.xml and download dependencies
COPY pom.xml ./
RUN mvn dependency:go-offline -B

# Copy the source code
COPY src ./src

# Build the application
RUN mvn package -DskipTests

# Run stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy the jar file from the build stage
# Spring Boot Maven plugin produces a single jar in the target directory
COPY --from=build /app/target/*.jar app.jar

# Expose the application port
EXPOSE 8080

# Use a non-root user for better security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
