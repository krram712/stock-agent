package com.axiom.user.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "alerts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String ticker;

    @Column(nullable = false)
    private String type; // PRICE_ABOVE, PRICE_BELOW, PERCENT_CHANGE, etc.

    private BigDecimal targetPrice;

    private String message;

    @Builder.Default
    private boolean active = true;

    private Instant triggeredAt;

    @CreationTimestamp
    private Instant createdAt;
}

