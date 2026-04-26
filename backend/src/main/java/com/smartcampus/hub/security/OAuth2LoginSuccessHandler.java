package com.smartcampus.hub.security;

import com.smartcampus.hub.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.net.URI;

@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AppProperties appProperties;
    private final HttpSessionSecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        // Store a minimal, fully-serializable SecurityContext (same idea as dev-login). The default
        // OAuth2AuthenticationToken can carry non-serializable OAuth client state and break HTTP
        // session persistence, so /api/auth/me sees no authentication after redirect.
        if (authentication instanceof OAuth2AuthenticationToken oauth
                && oauth.getPrincipal() instanceof AppUserPrincipal appUser) {
            UsernamePasswordAuthenticationToken sessionAuth =
                    new UsernamePasswordAuthenticationToken(appUser, null, appUser.getAuthorities());
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(sessionAuth);
            SecurityContextHolder.setContext(context);
            securityContextRepository.saveContext(context, request, response);
        }

        String base = resolveFrontendBase(request);
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        getRedirectStrategy().sendRedirect(request, response, base + "/auth/callback");
    }

    /**
     * After Google redirects back, prefer the browser-facing origin when the API is behind a dev
     * proxy (Vite sets X-Forwarded-Host). Otherwise use {@code app.frontend-url}. If both differ
     * by host, trust the configured SPA URL (split-domain production).
     */
    private String resolveFrontendBase(HttpServletRequest request) {
        String configured = trimTrailingSlash(appProperties.getFrontendUrl());
        if (!isForwarded(request)) {
            return configured;
        }
        try {
            URI built = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUri();
            if (built.getScheme() != null && built.getHost() != null) {
                // Always use the browser-facing origin from forwarded headers (Vite / reverse proxy)
                // so the post-login redirect matches where the session cookie was issued.
                return trimTrailingSlash(built.getScheme() + "://" + built.getRawAuthority());
            }
        } catch (IllegalArgumentException ignored) {
            // malformed app.frontend-url
        }
        return configured;
    }

    private static boolean isForwarded(HttpServletRequest request) {
        return StringUtils.hasText(request.getHeader("X-Forwarded-Host"))
                || StringUtils.hasText(request.getHeader("Forwarded"));
    }

    private static String trimTrailingSlash(String value) {
        if (value == null || value.isEmpty()) {
            return "http://localhost:5173";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
