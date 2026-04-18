package com.axiom.analysis.repository;

import com.axiom.analysis.model.StockAnalysis;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface AnalysisRepository extends JpaRepository<StockAnalysis, UUID> {
    Page<StockAnalysis> findByUserId(UUID userId, Pageable pageable);
}

