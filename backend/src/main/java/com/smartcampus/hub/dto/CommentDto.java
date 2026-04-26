package com.smartcampus.hub.dto;

import com.smartcampus.hub.entity.TicketComment;

import java.time.Instant;

public record CommentDto(
        Long id,
        Long ticketId,
        Long authorId,
        String authorName,
        String body,
        Instant createdAt,
        Instant updatedAt) {

    public static CommentDto from(TicketComment c) {
        return new CommentDto(
                c.getId(),
                c.getTicket().getId(),
                c.getAuthor().getId(),
                c.getAuthor().getDisplayName(),
                c.getBody(),
                c.getCreatedAt(),
                c.getUpdatedAt());
    }
}
