package com.axiom.user.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.*;

@Entity
@Table(name = "watchlists")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Watchlist {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "watchlist_tickers", joinColumns = @JoinColumn(name = "watchlist_id"))
    @Column(name = "ticker")
    @Builder.Default
    private List<String> tickers = new ArrayList<>();
}

