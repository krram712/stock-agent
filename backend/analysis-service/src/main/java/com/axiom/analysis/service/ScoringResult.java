package com.axiom.analysis.service;

import com.axiom.analysis.model.StockAnalysis.Verdict;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ScoringResult {
    private double trendScore, momentumScore, volumeScore, fundamentalScore,
        analystScore, newsScore, setupScore;
    private int overallScore;
    private Verdict verdict;
}

