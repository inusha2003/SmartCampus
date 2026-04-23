package com.smartcampus.hub.dto;

import com.smartcampus.hub.domain.TicketPriority;
import com.smartcampus.hub.domain.TicketStatus;
import com.smartcampus.hub.entity.Ticket;

import java.time.Instant;

public record TicketDto(
        Long id,
        Long reporterId,
        String reporterEmail,
        Long resourceId,
        String resourceName,
        String locationText,
        String category,
        String description,
        TicketPriority priority,
        String contactEmail,
        String contactPhone,
        TicketStatus status,
        Long assignedToId,
        String assignedToEmail,
        String resolutionNotes,
        Instant createdAt,
        Instant updatedAt) {

    public static TicketDto from(Ticket t) {
        return new TicketDto(
                t.getId(),
                t.getReporter().getId(),
                t.getReporter().getEmail(),
                t.getResource() != null ? t.getResource().getId() : null,
                t.getResource() != null ? t.getResource().getName() : null,
                t.getLocationText(),
                t.getCategory(),
                t.getDescription(),
                t.getPriority(),
                t.getContactEmail(),
                t.getContactPhone(),
                t.getStatus(),
                t.getAssignedTo() != null ? t.getAssignedTo().getId() : null,
                t.getAssignedTo() != null ? t.getAssignedTo().getEmail() : null,
                t.getResolutionNotes(),
                t.getCreatedAt(),
                t.getUpdatedAt());
    }
}
