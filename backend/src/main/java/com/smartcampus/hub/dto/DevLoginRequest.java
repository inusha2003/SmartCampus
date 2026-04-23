package com.smartcampus.hub.dto;

import com.smartcampus.hub.domain.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DevLoginRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(max = 120, message = "Name must be at most 120 characters") String name,
        @NotNull UserRole role) {
}
