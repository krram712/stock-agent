package com.axiom.analysis.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class AnalysisRequest {
    @NotBlank
    @Pattern(regexp = "^[A-Z.]{1,8}$", message = "Invalid ticker symbol")
    private String ticker;

    @NotBlank
    @Pattern(regexp = "^(day|weekly|monthly|quarterly|longterm)$")
    private String horizon;

    private String customPrompt;
    private boolean forceRefresh;
}

