package com.smartcampus.hub.service;

import com.smartcampus.hub.domain.NotificationType;
import com.smartcampus.hub.domain.TicketPriority;
import com.smartcampus.hub.domain.TicketStatus;
import com.smartcampus.hub.domain.UserRole;
import com.smartcampus.hub.entity.*;
import com.smartcampus.hub.exception.ApiException;
import com.smartcampus.hub.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class TicketService {

    private static final int MAX_ATTACHMENTS = 3;
    private static final int MAX_CATEGORY_LENGTH = 120;
    private static final int MAX_LOCATION_LENGTH = 500;
    private static final int MAX_DESCRIPTION_LENGTH = 4000;
    private static final int MAX_CONTACT_EMAIL_LENGTH = 254;
    private static final int MAX_CONTACT_PHONE_LENGTH = 25;
    private static final int MAX_COMMENT_LENGTH = 4000;
    private static final Pattern SIMPLE_EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern SIMPLE_PHONE = Pattern.compile("^[+0-9()\\-\\s]{7,25}$");

    private final TicketRepository ticketRepository;
    private final TicketAttachmentRepository ticketAttachmentRepository;
    private final TicketCommentRepository ticketCommentRepository;
    private final CampusResourceService campusResourceService;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final NotificationService notificationService;

    @Transactional
    public Ticket create(User reporter, Long resourceId, String locationText, String category,
                         String description, TicketPriority priority, String contactEmail, String contactPhone,
                         List<MultipartFile> files) {
        CampusResource resource = null;
        if (resourceId != null) {
            resource = campusResourceService.get(resourceId);
        }
        String normalizedLocation = normalizeOptionalText(locationText, MAX_LOCATION_LENGTH, "INVALID_LOCATION");
        if (resource == null && normalizedLocation == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "LOCATION_REQUIRED",
                    "Provide a resource or a location description");
        }
        String normalizedCategory = normalizeRequiredText(
                category, "CATEGORY_REQUIRED", "Category is required", MAX_CATEGORY_LENGTH, "INVALID_CATEGORY");
        String normalizedDescription = normalizeRequiredText(
                description, "DESCRIPTION_REQUIRED", "Description is required", MAX_DESCRIPTION_LENGTH, "INVALID_DESCRIPTION");
        String normalizedEmail = normalizeOptionalText(contactEmail, MAX_CONTACT_EMAIL_LENGTH, "INVALID_CONTACT_EMAIL");
        if (normalizedEmail != null && !SIMPLE_EMAIL.matcher(normalizedEmail).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTACT_EMAIL", "Contact email format is invalid");
        }
        String normalizedPhone = normalizeOptionalText(contactPhone, MAX_CONTACT_PHONE_LENGTH, "INVALID_CONTACT_PHONE");
        if (normalizedPhone != null && !SIMPLE_PHONE.matcher(normalizedPhone).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTACT_PHONE", "Contact phone format is invalid");
        }
        Ticket t = Ticket.builder()
                .reporter(reporter)
                .resource(resource)
                .locationText(normalizedLocation)
                .category(normalizedCategory)
                .description(normalizedDescription)
                .priority(priority != null ? priority : TicketPriority.MEDIUM)
                .contactEmail(normalizedEmail)
                .contactPhone(normalizedPhone)
                .status(TicketStatus.OPEN)
                .build();
        t = ticketRepository.save(t);
        if (files != null && !files.isEmpty()) {
            int n = Math.min(files.size(), MAX_ATTACHMENTS);
            for (int i = 0; i < n; i++) {
                MultipartFile f = files.get(i);
                if (f == null || f.isEmpty()) {
                    continue;
                }
                String path = fileStorageService.storeTicketAttachment(t.getId(), f);
                ticketAttachmentRepository.save(TicketAttachment.builder()
                        .ticket(t)
                        .originalFilename(f.getOriginalFilename())
                        .storedPath(path)
                        .contentType(f.getContentType())
                        .sizeBytes(f.getSize())
                        .build());
            }
        }
        return ticketRepository.findById(t.getId()).orElseThrow();
    }

    @Transactional(readOnly = true)
    public Ticket get(Long id) {
        return ticketRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Ticket not found"));
    }

    @Transactional(readOnly = true)
    public List<Ticket> listMine(User user) {
        return ticketRepository.findByReporterIdOrderByCreatedAtDesc(user.getId());
    }

    @Transactional(readOnly = true)
    public List<Ticket> listAssignable(User viewer) {
        if (viewer.getRole() == UserRole.ADMIN || viewer.getRole() == UserRole.TECHNICIAN) {
            return ticketRepository.findAllByOrderByCreatedAtDesc();
        }
        return listMine(viewer);
    }

    @Transactional
    public Ticket updateTicket(User actor, Long ticketId, TicketStatus status, Long assigneeUserId,
                               String resolutionNotes, String rejectReason) {
        Ticket t = get(ticketId);
        boolean admin = actor.getRole() == UserRole.ADMIN;
        boolean tech = actor.getRole() == UserRole.TECHNICIAN;
        if (!admin && !tech) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Staff only");
        }
        TicketStatus old = t.getStatus();
        if (assigneeUserId != null) {
            User assignee = userRepository.findById(assigneeUserId)
                    .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "USER_NOT_FOUND", "Assignee not found"));
            if (assignee.getRole() != UserRole.TECHNICIAN && assignee.getRole() != UserRole.ADMIN) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ASSIGNEE", "Assignee must be staff");
            }
            t.setAssignedTo(assignee);
        }
        String normalizedResolutionNotes = normalizeOptionalText(resolutionNotes, MAX_DESCRIPTION_LENGTH, "INVALID_RESOLUTION");
        String normalizedRejectReason = normalizeOptionalText(rejectReason, MAX_DESCRIPTION_LENGTH, "INVALID_REJECT_REASON");
        if (normalizedResolutionNotes != null) {
            t.setResolutionNotes(normalizedResolutionNotes);
        }
        if (status != null) {
            if (status == TicketStatus.REJECTED && !admin) {
                throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only admin can reject");
            }
            if ((status == TicketStatus.RESOLVED || status == TicketStatus.CLOSED) && !StringUtils.hasText(t.getResolutionNotes())
                    && normalizedResolutionNotes == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "RESOLUTION_REQUIRED",
                        "Resolution notes are required when resolving or closing a ticket");
            }
            t.setStatus(status);
            if (status == TicketStatus.REJECTED) {
                if (normalizedRejectReason == null) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "REJECT_REASON_REQUIRED",
                            "Reject reason is required when rejecting a ticket");
                }
                t.setResolutionNotes(normalizedRejectReason);
            }
        }
        ticketRepository.save(t);
        if (status != null && status != old) {
            notifyTicketStakeholders(t, "Ticket " + t.getId() + " is now " + status.name().replace('_', ' '));
        }
        return t;
    }

    private void notifyTicketStakeholders(Ticket t, String message) {
        notificationService.notify(t.getReporter(), NotificationType.TICKET_STATUS, "Ticket update", message,
                "TICKET", t.getId());
        if (t.getAssignedTo() != null && !Objects.equals(t.getAssignedTo().getId(), t.getReporter().getId())) {
            notificationService.notify(t.getAssignedTo(), NotificationType.TICKET_STATUS, "Ticket update", message,
                    "TICKET", t.getId());
        }
    }

    @Transactional(readOnly = true)
    public List<TicketComment> listComments(Long ticketId) {
        get(ticketId);
        return ticketCommentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);
    }

    @Transactional
    public TicketComment addComment(User author, Long ticketId, String body) {
        Ticket t = get(ticketId);
        String normalizedBody = normalizeRequiredText(
                body, "BODY", "Comment body required", MAX_COMMENT_LENGTH, "INVALID_COMMENT");
        TicketComment c = TicketComment.builder()
                .ticket(t)
                .author(author)
                .body(normalizedBody)
                .build();
        c = ticketCommentRepository.save(c);
        if (!Objects.equals(author.getId(), t.getReporter().getId())) {
            notificationService.notify(t.getReporter(), NotificationType.TICKET_COMMENT,
                    "New comment on ticket #" + ticketId,
                    author.getDisplayName() + ": "
                            + (normalizedBody.length() > 200 ? normalizedBody.substring(0, 200) + "…" : normalizedBody),
                    "TICKET", ticketId);
        }
        if (t.getAssignedTo() != null
                && !Objects.equals(t.getAssignedTo().getId(), author.getId())
                && !Objects.equals(t.getAssignedTo().getId(), t.getReporter().getId())) {
            notificationService.notify(t.getAssignedTo(), NotificationType.TICKET_COMMENT,
                    "New comment on ticket #" + ticketId,
                    author.getDisplayName() + ": "
                            + (normalizedBody.length() > 200 ? normalizedBody.substring(0, 200) + "…" : normalizedBody),
                    "TICKET", ticketId);
        }
        return c;
    }

    @Transactional
    public TicketComment editComment(User actor, Long ticketId, Long commentId, String body) {
        TicketComment c = ticketCommentRepository.findById(commentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Comment not found"));
        if (!c.getTicket().getId().equals(ticketId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MISMATCH", "Comment does not belong to ticket");
        }
        boolean owner = c.getAuthor().getId().equals(actor.getId());
        boolean admin = actor.getRole() == UserRole.ADMIN;
        if (!owner && !admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cannot edit this comment");
        }
        c.setBody(normalizeRequiredText(body, "BODY", "Comment body required", MAX_COMMENT_LENGTH, "INVALID_COMMENT"));
        return ticketCommentRepository.save(c);
    }

    @Transactional
    public void deleteComment(User actor, Long ticketId, Long commentId) {
        TicketComment c = ticketCommentRepository.findById(commentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Comment not found"));
        if (!c.getTicket().getId().equals(ticketId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MISMATCH", "Comment does not belong to ticket");
        }
        boolean owner = c.getAuthor().getId().equals(actor.getId());
        boolean admin = actor.getRole() == UserRole.ADMIN;
        if (!owner && !admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cannot delete this comment");
        }
        ticketCommentRepository.delete(c);
    }

    @Transactional(readOnly = true)
    public List<TicketAttachment> listAttachments(Long ticketId) {
        get(ticketId);
        return ticketAttachmentRepository.findByTicketId(ticketId);
    }

    public void assertCanReadTicket(User user, Ticket t) {
        boolean staff = user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.TECHNICIAN;
        boolean reporter = t.getReporter().getId().equals(user.getId());
        boolean assignee = t.getAssignedTo() != null && t.getAssignedTo().getId().equals(user.getId());
        if (!staff && !reporter && !assignee) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cannot access this ticket");
        }
    }

    private String normalizeRequiredText(String value, String emptyCode, String emptyMessage, int maxLen, String lenCode) {
        String trimmed = value == null ? null : value.trim();
        if (!StringUtils.hasText(trimmed)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, emptyCode, emptyMessage);
        }
        if (trimmed.length() > maxLen) {
            throw new ApiException(HttpStatus.BAD_REQUEST, lenCode, "Text exceeds maximum length of " + maxLen);
        }
        return trimmed;
    }

    private String normalizeOptionalText(String value, int maxLen, String lenCode) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > maxLen) {
            throw new ApiException(HttpStatus.BAD_REQUEST, lenCode, "Text exceeds maximum length of " + maxLen);
        }
        return trimmed;
    }
}
