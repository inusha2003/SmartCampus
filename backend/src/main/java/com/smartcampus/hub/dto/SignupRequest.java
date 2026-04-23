package com.smartcampus.hub.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(max = 120, message = "Display name must be at most 120 characters") String displayName,
        @NotBlank @Size(min = 8, max = 72, message = "Password must be 8–72 characters") String password) {
}
