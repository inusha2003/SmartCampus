package com.smartcampus.hub.controller;

import com.smartcampus.hub.dto.LoginRequest;
import com.smartcampus.hub.dto.SignupRequest;
import com.smartcampus.hub.dto.UserDto;
import com.smartcampus.hub.entity.User;
import com.smartcampus.hub.security.AppUserPrincipal;
import com.smartcampus.hub.service.LocalAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class LocalAuthController {

    private final LocalAuthService localAuthService;

    @PostMapping("/signup")
    public UserDto signup(@Valid @RequestBody SignupRequest req,
                          HttpServletRequest request,
                          HttpServletResponse response) {
        User user = localAuthService.signup(req.email(), req.displayName(), req.password());
        establishSession(user, request, response);
        return UserDto.from(user);
    }

    @PostMapping("/login")
    public UserDto login(@Valid @RequestBody LoginRequest req,
                         HttpServletRequest request,
                         HttpServletResponse response) {
        User user = localAuthService.authenticate(req.email(), req.password());
        establishSession(user, request, response);
        return UserDto.from(user);
    }

    private void establishSession(User user, HttpServletRequest request, HttpServletResponse response) {
        AppUserPrincipal principal = AppUserPrincipal.fromLocalUser(user);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        new HttpSessionSecurityContextRepository().saveContext(context, request, response);
    }
}
