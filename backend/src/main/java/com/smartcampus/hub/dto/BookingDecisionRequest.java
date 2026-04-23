package com.smartcampus.hub.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BookingDecisionRequest(
        @NotNull Boolean approve,
        @Size(max = 500, message = "Decision reason must be at most 500 characters") String reason) {
}
