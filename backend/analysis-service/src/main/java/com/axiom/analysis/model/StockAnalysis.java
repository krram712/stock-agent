package com.axiom.analysis.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "stock_analyses")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 10)
    private String ticker;

    @Column(nullable = false, length = 20)
    private String horizon;

    private UUID userId;

    @Column(columnDefinition = "TEXT")
    private String executiveSummary;
    @Column(columnDefinition = "TEXT")
    private String marketPulse;
    @Column(columnDefinition = "TEXT")
    private String technicalAnalysis;
    @Column(columnDefinition = "TEXT")
    private String supportResistance;
    @Column(columnDefinition = "TEXT")
    private String fundamentals;
    @Column(columnDefinition = "TEXT")
    private String entryExitSignals;
    @Column(columnDefinition = "TEXT")
    private String bullBearScorecard;
    @Column(columnDefinition = "TEXT")
    private String riskFactors;
    @Column(columnDefinition = "TEXT")
    private String tradePlan;

    private Integer overallScore;

    @Enumerated(EnumType.STRING)
    private Verdict verdict;

    private BigDecimal entryLow;
    private BigDecimal entryHigh;
    private BigDecimal stopLoss;
    private BigDecimal target1;
    private BigDecimal target2;
    private BigDecimal target3;
    private BigDecimal riskReward;

    @Column(columnDefinition = "TEXT")
    private String customAnalysis;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant expiresAt;

    public enum Verdict {
        STRONG_BULL, MILD_BULL, NEUTRAL, MILD_BEAR, STRONG_BEAR
    }
}

