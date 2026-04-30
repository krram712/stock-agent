package com.axiom.analysis.service;

import com.axiom.analysis.repository.AnalysisRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class AnalysisCleanupJob {

    private final AnalysisRepository analysisRepository;

    // Runs every 4 hours — deletes analyses older than 7 days
    @Scheduled(fixedRateString = "PT4H", initialDelayString = "PT5M")
    public void purgeExpired() {
        int deleted = analysisRepository.deleteExpired(Instant.now());
        if (deleted > 0) {
            log.info("🧹 Purged {} expired analyses (older than 7 days)", deleted);
        }
    }
}