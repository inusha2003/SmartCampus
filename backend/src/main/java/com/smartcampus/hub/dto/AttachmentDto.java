package com.smartcampus.hub.dto;

import com.smartcampus.hub.entity.TicketAttachment;

import java.time.Instant;

public record AttachmentDto(
        Long id,
        Long ticketId,
        String originalFilename,
        String contentType,
        long sizeBytes,
        Instant createdAt) {

    public static AttachmentDto from(TicketAttachment a) {
        return new AttachmentDto(
                a.getId(),
                a.getTicket().getId(),
                a.getOriginalFilename(),
                a.getContentType(),
                a.getSizeBytes(),
                a.getCreatedAt());
    }
}
