FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /src
COPY services/payments-service/pom.xml .
RUN mvn -q dependency:go-offline
COPY services/payments-service/src ./src
RUN mvn -q package -DskipTests

FROM eclipse-temurin:17-jre

WORKDIR /app
COPY --from=builder /src/target/payments-service-0.0.1.jar /app/payments-service.jar

ENV SERVER_PORT=8000
EXPOSE 8000

CMD ["java", "-jar", "/app/payments-service.jar"]
