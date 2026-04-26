package com.axiom.user.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(unique = true)
    private String username;

    @Column(nullable = false)
    private String passwordHash;

    private String firstName;
    private String lastName;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Role role = Role.USER;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AccountStatus status = AccountStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SubscriptionTier tier = SubscriptionTier.FREE;

    @Builder.Default
    private boolean emailVerified = false;

    private String fcmToken;
    private String defaultHorizon;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    public enum Role { USER, PREMIUM, ADMIN }
    public enum SubscriptionTier { FREE, PRO, ENTERPRISE }
    public enum AccountStatus { PENDING, APPROVED, REJECTED }
}

