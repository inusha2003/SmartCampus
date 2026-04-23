package com.smartcampus.hub.dto;

import com.smartcampus.hub.domain.ResourceStatus;
import com.smartcampus.hub.domain.ResourceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;

public record CreateResourceRequest(
        @NotBlank @Size(max = 120, message = "Name must be at most 120 characters") String name,
        @NotNull ResourceType type,
        @PositiveOrZero(message = "Capacity cannot be negative") Integer capacity,
        @NotBlank @Size(max = 200, message = "Location must be at most 200 characters") String location,
        @Size(max = 2000, message = "Availability window must be at most 2000 characters") String availabilityWindows,
        ResourceStatus status) {
}
