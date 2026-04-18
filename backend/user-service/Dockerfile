FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY user-service/pom.xml user-service/
COPY stock-data-service/pom.xml stock-data-service/
COPY analysis-service/pom.xml analysis-service/
COPY api-gateway/pom.xml api-gateway/
# Download dependencies first (cache layer)
RUN apk add --no-cache maven && \
    mvn dependency:go-offline -pl user-service -am -q
COPY user-service/src user-service/src
RUN mvn package -pl user-service -am -DskipTests -q

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/user-service/target/user-service-1.0.0.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]

