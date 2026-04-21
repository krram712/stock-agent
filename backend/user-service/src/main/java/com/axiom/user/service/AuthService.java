package com.axiom.user.service;

import com.axiom.user.dto.*;
import com.axiom.user.model.User;
import com.axiom.user.repository.UserRepository;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Date;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    // In-memory refresh token store (replaces Redis for local dev)
    private final Map<String, String> refreshTokenStore = new ConcurrentHashMap<>();

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.access-token-expiry:900000}")
    private long accessTokenExpiry;

    @Value("${jwt.refresh-token-expiry:604800000}")
    private long refreshTokenExpiry;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new IllegalArgumentException("Email already in use");
        }
        User user = User.builder()
            .email(req.getEmail())
            .passwordHash(passwordEncoder.encode(req.getPassword()))
            .firstName(req.getFirstName())
            .lastName(req.getLastName())
            .build();
        userRepository.save(user);
        return buildAuthResponse(user);
    }

    public AuthResponse login(LoginRequest req) {
        // Support login by email OR username
        User user = userRepository.findByEmailOrUsername(req.getEmail(), req.getEmail())
            .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        return buildAuthResponse(user);
    }

    public AuthResponse refresh(String refreshToken) {
        String userId = refreshTokenStore.get("refresh:" + refreshToken);
        if (userId == null) throw new IllegalArgumentException("Invalid or expired refresh token");
        User user = userRepository.findById(UUID.fromString(userId))
            .orElseThrow(() -> new IllegalStateException("User not found"));
        refreshTokenStore.remove("refresh:" + refreshToken);
        return buildAuthResponse(user);
    }

    public void logout(String refreshToken) {
        refreshTokenStore.remove("refresh:" + refreshToken);
    }

    private AuthResponse buildAuthResponse(User user) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        String accessToken = Jwts.builder()
            .setSubject(user.getId().toString())
            .claim("email", user.getEmail())
            .claim("role", user.getRole().name())
            .claim("tier", user.getTier().name())
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + accessTokenExpiry))
            .signWith(key)
            .compact();

        String refreshToken = UUID.randomUUID().toString();
        refreshTokenStore.put("refresh:" + refreshToken, user.getId().toString());

        UserDto dto = new UserDto();
        dto.setId(user.getId().toString());
        dto.setEmail(user.getEmail());
        dto.setUsername(user.getUsername());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setRole(user.getRole().name());
        dto.setTier(user.getTier().name());

        AuthResponse response = new AuthResponse();
        response.setAccessToken(accessToken);
        response.setRefreshToken(refreshToken);
        response.setExpiresIn(accessTokenExpiry / 1000);
        response.setUser(dto);
        return response;
    }
}

