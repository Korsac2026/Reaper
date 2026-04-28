# Stage 1: Build
FROM gradle:8.5-jdk21 AS builder
WORKDIR /app
COPY . .
RUN gradle shadowJar --no-daemon

# Stage 2: Run
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/XorAuth-1.0-SNAPSHOT-all.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
