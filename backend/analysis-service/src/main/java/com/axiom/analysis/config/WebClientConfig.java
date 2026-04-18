package com.axiom.analysis.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Value("${stock-data-service.url:http://localhost:8082}")
    private String stockDataServiceUrl;

    @Bean
    public WebClient stockDataClient() {
        return WebClient.builder().baseUrl(stockDataServiceUrl).build();
    }
}

