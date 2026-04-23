package com.smartcampus.hub.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record CreateBookingRequest(
        @NotNull Long resourceId,
        @NotNull Instant startAt,
        @NotNull Instant endAt,
        @Size(max = 500, message = "Purpose must be at most 500 characters") String purpose,
        @Positive(message = "Expected attendees must be greater than 0")
        Integer expectedAttendees) {
}
