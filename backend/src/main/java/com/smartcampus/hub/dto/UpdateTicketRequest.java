package com.smartcampus.hub.dto;

import com.smartcampus.hub.domain.TicketStatus;
import jakarta.validation.constraints.Size;

public record UpdateTicketRequest(
        TicketStatus status,
        Long assigneeUserId,
        @Size(max = 4000, message = "Resolution notes must be at most 4000 characters") String resolutionNotes,
        @Size(max = 4000, message = "Reject reason must be at most 4000 characters") String rejectReason) {
}
