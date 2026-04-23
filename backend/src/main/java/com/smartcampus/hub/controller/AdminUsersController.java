package com.smartcampus.hub.controller;

import com.smartcampus.hub.domain.UserRole;
import com.smartcampus.hub.dto.UserDto;
import com.smartcampus.hub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminUsersController {

    private final UserRepository userRepository;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @GetMapping("/users-staff")
    @PreAuthorize("hasAnyRole('ADMIN','TECHNICIAN')")
    public List<UserDto> staffUsers() {
        return userRepository.findByRoleIn(List.of(UserRole.ADMIN, UserRole.TECHNICIAN)).stream()
                .map(UserDto::from)
                .toList();
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserDto> allUsers() {
        return userRepository.findAll().stream()
                .map(UserDto::from)
                .toList();
    }

    public record UpdateRoleRequest(UserRole role) {}

    @org.springframework.web.bind.annotation.PutMapping("/users/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public UserDto updateUserRole(
            @org.springframework.web.bind.annotation.PathVariable Long id,
            @org.springframework.web.bind.annotation.RequestBody UpdateRoleRequest req) {
        com.smartcampus.hub.entity.User user = userRepository.findById(id)
                .orElseThrow(() -> new com.smartcampus.hub.exception.ApiException(
                        org.springframework.http.HttpStatus.NOT_FOUND, 
                        "NOT_FOUND", 
                        "User not found"));
        user.setRole(req.role());
        return UserDto.from(userRepository.save(user));
    }

    public record CreateUserRequest(String email, String displayName, String password, UserRole role) {}

    @org.springframework.web.bind.annotation.PostMapping("/users")
    @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public UserDto createUser(@org.springframework.web.bind.annotation.RequestBody CreateUserRequest req) {
        if (userRepository.findByEmail(req.email()).isPresent()) {
            throw new com.smartcampus.hub.exception.ApiException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "EMAIL_EXISTS", "Email already in use");
        }
        com.smartcampus.hub.entity.User user = com.smartcampus.hub.entity.User.builder()
                .email(req.email())
                .displayName(req.displayName())
                .role(req.role() != null ? req.role() : UserRole.USER)
                .passwordHash(passwordEncoder.encode(req.password()))
                .build();
        return UserDto.from(userRepository.save(user));
    }

    public record UpdateUserRequest(String email, String displayName) {}

    @org.springframework.web.bind.annotation.PutMapping("/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public UserDto updateUser(
            @org.springframework.web.bind.annotation.PathVariable Long id,
            @org.springframework.web.bind.annotation.RequestBody UpdateUserRequest req) {
        com.smartcampus.hub.entity.User user = userRepository.findById(id)
                .orElseThrow(() -> new com.smartcampus.hub.exception.ApiException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "NOT_FOUND", "User not found"));
        
        if (!user.getEmail().equals(req.email()) && userRepository.findByEmail(req.email()).isPresent()) {
            throw new com.smartcampus.hub.exception.ApiException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "EMAIL_EXISTS", "Email already in use");
        }
        
        user.setEmail(req.email());
        user.setDisplayName(req.displayName());
        return UserDto.from(userRepository.save(user));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/users/{id}")
    @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteUser(@org.springframework.web.bind.annotation.PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            throw new com.smartcampus.hub.exception.ApiException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "NOT_FOUND", "User not found");
        }
        try {
            userRepository.deleteById(id);
        } catch (Exception e) {
            throw new com.smartcampus.hub.exception.ApiException(
                    org.springframework.http.HttpStatus.CONFLICT, "INTEGRITY", "Cannot delete user. They are associated with active bookings or tickets.");
        }
    }
}
