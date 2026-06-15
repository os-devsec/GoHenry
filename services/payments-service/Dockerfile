FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /src
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q package -DskipTests

FROM eclipse-temurin:17-jre

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
        -o /tmp/aws-rds-global-bundle.pem \
    && awk '/-----BEGIN CERTIFICATE-----/{file=sprintf("/tmp/aws-rds-%02d.pem", ++count)} file{print > file}' \
        /tmp/aws-rds-global-bundle.pem \
    && for certificate in /tmp/aws-rds-[0-9][0-9].pem; do \
        keytool -importcert -noprompt -trustcacerts \
            -alias "$(basename "$certificate" .pem)" \
            -file "$certificate" \
            -cacerts \
            -storepass changeit; \
    done \
    && rm -f /tmp/aws-rds-*.pem \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /src/target/payments-service-0.0.1.jar /app/payments-service.jar

ENV SERVER_PORT=8000
EXPOSE 8000

CMD ["java", "-jar", "/app/payments-service.jar"]
