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

    @GetMapping("/users-staff")
    @PreAuthorize("hasAnyRole('ADMIN','TECHNICIAN')")
    public List<UserDto> staffUsers() {
        return userRepository.findByRoleIn(List.of(UserRole.ADMIN, UserRole.TECHNICIAN)).stream()
                .map(UserDto::from)
                .toList();
    }
}
