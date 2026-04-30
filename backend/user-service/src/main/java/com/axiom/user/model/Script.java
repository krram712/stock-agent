package com.axiom.user.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "scripts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Script {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String version;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private String category;   // SIGNAL, SCREENER, OPTIONS, STRATEGY

    @Column(nullable = false)
    private String language;   // PINE, PYTHON

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Builder.Default
    private boolean active = true;

    @Builder.Default
    @Column(updatable = false)
    private Instant createdAt = Instant.now();

    private Instant updatedAt;

    @PreUpdate
    void onUpdate() { this.updatedAt = Instant.now(); }
}