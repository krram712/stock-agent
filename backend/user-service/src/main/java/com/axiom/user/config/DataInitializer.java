package com.axiom.user.config;

import com.axiom.user.model.User;
import com.axiom.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) {
        seedAdmin("raghu@axiom.ai", "raghu", "bigsky3016", "Raghu", "Admin");
        seedAdmin("demo@axiom.ai",  "demo",  "Demo1234!", "Demo",  "User");
    }

    private void seedAdmin(String email, String username, String rawPassword,
                           String firstName, String lastName) {
        if (!userRepository.existsByEmail(email)) {
            User admin = User.builder()
                .email(email)
                .username(username)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .firstName(firstName)
                .lastName(lastName)
                .role(email.startsWith("raghu") ? User.Role.ADMIN : User.Role.USER)
                .tier(email.startsWith("raghu") ? User.SubscriptionTier.ENTERPRISE : User.SubscriptionTier.FREE)
                .emailVerified(true)
                .build();
            userRepository.save(admin);
            log.info("✅ Seeded user: {} / username: {} ({})", email, username, admin.getRole());
        } else {
            log.info("ℹ️  User already exists: {}", email);
        }
    }
}

