package com.smartcampus.hub.dto;

import com.smartcampus.hub.domain.BookingStatus;
import com.smartcampus.hub.entity.Booking;

import java.time.Instant;

public record BookingDto(
        Long id,
        Long resourceId,
        String resourceName,
        Long requesterId,
        String requesterEmail,
        Instant startAt,
        Instant endAt,
        String purpose,
        Integer expectedAttendees,
        BookingStatus status,
        String decisionReason,
        Instant createdAt) {

    public static BookingDto from(Booking b) {
        return new BookingDto(
                b.getId(),
                b.getResource().getId(),
                b.getResource().getName(),
                b.getRequester().getId(),
                b.getRequester().getEmail(),
                b.getStartAt(),
                b.getEndAt(),
                b.getPurpose(),
                b.getExpectedAttendees(),
                b.getStatus(),
                b.getDecisionReason(),
                b.getCreatedAt());
    }
}
