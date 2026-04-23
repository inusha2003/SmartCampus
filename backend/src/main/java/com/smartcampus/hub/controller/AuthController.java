package com.smartcampus.hub.controller;

import com.smartcampus.hub.dto.UserDto;
import com.smartcampus.hub.security.CurrentUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Value("${spring.security.oauth2.client.registration.google.client-id:}")
    private String googleClientId;

    @Value("${spring.security.oauth2.client.registration.google.client-secret:}")
    private String googleClientSecret;

    private boolean isGoogleConfigured() {
        return isRealValue(googleClientId) && isRealValue(googleClientSecret);
    }

    private boolean isRealValue(String value) {
        if (value == null) {
            return false;
        }
        String normalized = value.trim();
        return !normalized.isEmpty() && !normalized.startsWith("replace-me");
    }

    @GetMapping("/me")
    public UserDto me() {
        return UserDto.from(CurrentUser.requireUser());
    }

    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        if (token == null) {
            return Map.of("token", "", "parameterName", "_csrf", "headerName", "X-XSRF-TOKEN");
        }
        return Map.of(
                "token", token.getToken(),
                "parameterName", token.getParameterName(),
                "headerName", token.getHeaderName());
    }

    @GetMapping("/providers")
    public Map<String, Object> providers() {
        return Map.of("googleConfigured", isGoogleConfigured());
    }
}
