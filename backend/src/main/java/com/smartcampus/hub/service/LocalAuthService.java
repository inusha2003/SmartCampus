package com.smartcampus.hub.service;

import com.smartcampus.hub.domain.UserRole;
import com.smartcampus.hub.entity.User;
import com.smartcampus.hub.exception.ApiException;
import com.smartcampus.hub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class LocalAuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public User signup(String email, String displayName, String password) {
        String normalizedEmail = normalizeEmail(email);
        if (userRepository.findByEmail(normalizedEmail).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_IN_USE", "An account with this email already exists");
        }
        User user = User.builder()
                .email(normalizedEmail)
                .displayName(displayName.trim())
                .role(UserRole.USER)
                .passwordHash(passwordEncoder.encode(password))
                .build();
        return userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public User authenticate(String email, String password) {
        String normalizedEmail = normalizeEmail(email);
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "AUTH", "Invalid email or password"));
        String hash = user.getPasswordHash();
        if (hash == null || !passwordEncoder.matches(password, hash)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTH", "Invalid email or password");
        }
        return user;
    }
}
