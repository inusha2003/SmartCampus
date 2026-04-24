package com.smartcampus.hub.service;

import com.smartcampus.hub.domain.NotificationType;
import com.smartcampus.hub.entity.Notification;
import com.smartcampus.hub.entity.User;
import com.smartcampus.hub.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    @Transactional
    public void notify(User user, NotificationType type, String title, String message,
                       String relatedEntityType, Long relatedEntityId) {
        notificationRepository.save(Notification.builder()
                .user(user)
                .type(type)
                .title(title)
                .message(message)
                .readFlag(false)
                .relatedEntityType(relatedEntityType)
                .relatedEntityId(relatedEntityId)
                .build());
    }

    @Transactional(readOnly = true)
    public List<Notification> listForUser(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return notificationRepository.countByUserIdAndReadFlagFalse(userId);
    }

    @Transactional
    public void markRead(Long notificationId, Long userId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new com.smartcampus.hub.exception.ApiException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "NOT_FOUND", "Notification not found"));
        if (!n.getUser().getId().equals(userId)) {
            throw new com.smartcampus.hub.exception.ApiException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "FORBIDDEN", "Not your notification");
        }
        n.setReadFlag(true);
    }

    @Transactional
    public void markAllRead(Long userId) {
        var list = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        list.forEach(n -> n.setReadFlag(true));
        notificationRepository.saveAll(list);
    }

    @Transactional
    public void deleteAllForUser(Long userId) {
        notificationRepository.deleteByUser_Id(userId);
    }
}
