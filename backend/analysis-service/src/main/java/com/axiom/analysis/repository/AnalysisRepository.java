package com.axiom.analysis.repository;

import com.axiom.analysis.model.StockAnalysis;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.UUID;

public interface AnalysisRepository extends JpaRepository<StockAnalysis, UUID> {
    Page<StockAnalysis> findByUserId(UUID userId, Pageable pageable);

    @Modifying
    @Transactional
    @Query("DELETE FROM StockAnalysis a WHERE a.expiresAt < :now")
    int deleteExpired(Instant now);
}

