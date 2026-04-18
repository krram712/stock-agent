FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY user-service/pom.xml user-service/
COPY stock-data-service/pom.xml stock-data-service/
COPY analysis-service/pom.xml analysis-service/
COPY api-gateway/pom.xml api-gateway/
RUN apk add --no-cache maven && \
    mvn dependency:go-offline -pl analysis-service -am -q
COPY analysis-service/src analysis-service/src
COPY stock-data-service/src stock-data-service/src
RUN mvn package -pl analysis-service -am -DskipTests -q

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/analysis-service/target/analysis-service-1.0.0.jar app.jar
EXPOSE 8083
ENTRYPOINT ["java", "-jar", "app.jar"]

