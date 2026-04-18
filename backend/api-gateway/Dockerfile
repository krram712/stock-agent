FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY user-service/pom.xml user-service/
COPY stock-data-service/pom.xml stock-data-service/
COPY analysis-service/pom.xml analysis-service/
COPY api-gateway/pom.xml api-gateway/
RUN apk add --no-cache maven && \
    mvn dependency:go-offline -pl api-gateway -am -q
COPY api-gateway/src api-gateway/src
RUN mvn package -pl api-gateway -am -DskipTests -q

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/api-gateway/target/api-gateway-1.0.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

