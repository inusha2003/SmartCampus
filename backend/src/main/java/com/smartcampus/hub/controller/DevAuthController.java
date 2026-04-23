package com.smartcampus.hub.controller;

import com.smartcampus.hub.config.AppProperties;
import com.smartcampus.hub.domain.UserRole;
import com.smartcampus.hub.dto.DevLoginRequest;
import com.smartcampus.hub.dto.UserDto;
import com.smartcampus.hub.entity.User;
import com.smartcampus.hub.exception.ApiException;
import com.smartcampus.hub.repository.UserRepository;
import com.smartcampus.hub.security.AppUserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Profile("dev")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class DevAuthController {

    private final UserRepository userRepository;
    private final AppProperties appProperties;

    @PostMapping("/dev-login")
    public UserDto devLogin(@Valid @RequestBody DevLoginRequest req,
                            HttpServletRequest request,
                            HttpServletResponse response) {
        if (!appProperties.isDevAuthEnabled()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "N/A", "Dev login is disabled");
        }
        if (req.role() != UserRole.USER && req.role() != UserRole.ADMIN && req.role() != UserRole.TECHNICIAN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROLE", "Invalid role");
        }
        User user = userRepository.findByEmail(req.email())
                .orElseGet(() -> User.builder()
                        .email(req.email())
                        .displayName(req.name())
                        .role(req.role())
                        .oauthProvider("dev")
                        .oauthSubject("dev-" + req.email())
                        .build());
        user.setDisplayName(req.name());
        user.setRole(req.role());
        user = userRepository.save(user);

        AppUserPrincipal principal = AppUserPrincipal.fromLocalUser(user);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        new HttpSessionSecurityContextRepository().saveContext(context, request, response);
        return UserDto.from(user);
    }
}
