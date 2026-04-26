package com.smartcampus.hub.dto;

import com.smartcampus.hub.domain.NotificationType;
import com.smartcampus.hub.entity.Notification;

import java.time.Instant;

public record NotificationDto(
        Long id,
        NotificationType type,
        String title,
        String message,
        boolean read,
        String relatedEntityType,
        Long relatedEntityId,
        Instant createdAt) {

    public static NotificationDto from(Notification n) {
        return new NotificationDto(
                n.getId(),
                n.getType(),
                n.getTitle(),
                n.getMessage(),
                n.isReadFlag(),
                n.getRelatedEntityType(),
                n.getRelatedEntityId(),
                n.getCreatedAt());
    }
}
