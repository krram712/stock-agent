package com.axiom.user.config;

import com.axiom.user.model.Script;
import com.axiom.user.model.User;
import com.axiom.user.repository.ScriptRepository;
import com.axiom.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final UserRepository    userRepository;
    private final ScriptRepository  scriptRepository;
    private final PasswordEncoder   passwordEncoder;

    @Override
    public void run(ApplicationArguments args) {
        seedAdmin("raghu@axiom.ai", "raghu",  "bigsky3016", "Raghu", "Admin");
        seedAdmin("demo@axiom.ai",  "demo",   "Demo1234!",  "Demo",  "User");
        seedScripts();
    }

    // ── Users ────────────────────────────────────────────────────────
    private void seedAdmin(String email, String username, String rawPassword,
                           String firstName, String lastName) {
        User.Role role = email.startsWith("raghu") ? User.Role.ADMIN : User.Role.USER;
        User.SubscriptionTier tier = email.startsWith("raghu") ? User.SubscriptionTier.ENTERPRISE : User.SubscriptionTier.FREE;

        userRepository.findByEmailOrUsername(email, email).ifPresentOrElse(existing -> {
            // Ensure seeded accounts are always APPROVED (fixes PENDING after null→PENDING SQL migration)
            if (existing.getStatus() != User.AccountStatus.APPROVED) {
                existing.setStatus(User.AccountStatus.APPROVED);
                userRepository.save(existing);
                log.info("✅ Fixed status → APPROVED for seeded user: {}", email);
            } else {
                log.info("ℹ️  User already exists: {}", email);
            }
        }, () -> {
            User user = User.builder()
                .email(email)
                .username(username)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .firstName(firstName)
                .lastName(lastName)
                .role(role)
                .tier(tier)
                .emailVerified(true)
                .status(User.AccountStatus.APPROVED)
                .build();
            userRepository.save(user);
            log.info("✅ Seeded user: {} ({})", email, user.getRole());
        });
    }

    // ── Scripts ──────────────────────────────────────────────────────
    private void seedScripts() {
        seedScript("AXIOM Bull/Bear Scoring Engine", "2.0", "SIGNAL",
            "5-layer scoring engine: Trend, Momentum, Volume, Volatility, Patterns. " +
            "Candlestick detection (engulfing, pin bar, morning star). Webhook alerts to dashboard.",
            "scripts/bullbear-v2.pine");

        seedScript("AXIOM Elite Signal Engine", "3.0", "SIGNAL",
            "Advanced 5-layer system: Elder Triple Screen, Minervini SEPA, Bollinger/Keltner squeeze, " +
            "Weinstein Stage Analysis, RSI divergence, CMF, OBV, ATR dynamic stops. Market regime filter.",
            "scripts/elite-v3.pine");

        seedScript("AXIOM Master Pattern Signal", "1.0", "SIGNAL",
            "Pattern-focused signal engine detecting 22 chart patterns including flags, wedges, " +
            "head & shoulders, and breakout setups with scoring.",
            "scripts/master-pattern.pine");

        seedScript("AXIOM Ultimate Watchlist Screener", "1.0", "SCREENER",
            "Multi-stock screener that ranks tickers by bull/bear score, RVOL, RSI, and trend alignment. " +
            "Designed for TradingView screener integration.",
            "scripts/watchlist-screener.pine");

        seedScript("AXIOM Options Strategy Engine", "1.0", "OPTIONS",
            "Options strategy selector using IV rank, delta, gamma exposure, and expected move. " +
            "Recommends Bull Call Spread, Bear Put Spread, Iron Condor, or Straddle.",
            "scripts/options-engine.pine");
    }

    private void seedScript(String name, String version, String category,
                            String description, String resourcePath) {
        if (scriptRepository.existsByNameAndVersion(name, version)) {
            log.info("ℹ️  Script already seeded: {} v{}", name, version);
            return;
        }
        try {
            String content = StreamUtils.copyToString(
                new ClassPathResource(resourcePath).getInputStream(),
                StandardCharsets.UTF_8);
            Script script = Script.builder()
                .name(name)
                .version(version)
                .category(category)
                .language("PINE")
                .description(description)
                .content(content)
                .active(true)
                .build();
            scriptRepository.save(script);
            log.info("✅ Seeded script: {} v{} ({} chars)", name, version, content.length());
        } catch (Exception e) {
            log.warn("⚠️  Could not seed script {} v{}: {}", name, version, e.getMessage());
        }
    }
}