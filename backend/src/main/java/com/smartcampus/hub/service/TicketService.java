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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class TicketService {

    private static final int MAX_ATTACHMENTS = 3;
    private static final int MAX_CATEGORY_LENGTH = 120;
    private static final int MAX_TITLE_LENGTH = 200;
    private static final int MAX_LOCATION_LENGTH = 500;
    /** Ticket issue description (reporter); no whitespace, short cap. */
    private static final int MAX_TICKET_DESCRIPTION_LENGTH = 150;
    private static final int MAX_DESCRIPTION_LENGTH = 4000;
    private static final int MAX_CONTACT_NAME_LENGTH = 120;
    private static final int MAX_CONTACT_EMAIL_LENGTH = 254;
    private static final int MAX_CONTACT_PHONE_LENGTH = 10;
    private static final int MAX_COMMENT_LENGTH = 4000;
    private static final Pattern SIMPLE_EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    /** Letters (any script), digits, @ and . only — matches frontend input rules. */
    private static final Pattern EMAIL_ALLOWED_CHARS = Pattern.compile("^[\\p{L}\\p{N}@.]+$");
    /** Digits only, exactly 10 (e.g. Sri Lanka mobile). */
    private static final Pattern PHONE_DIGITS_ONLY = Pattern.compile("^\\d{10}$");
    /** Unicode letters, spaces, period, apostrophe, hyphen (for names). */
    private static final Pattern CONTACT_NAME_LETTERS = Pattern.compile("^[\\p{L}\\s'.-]+$");

    private static final EnumSet<TicketStatus> REPORTER_MUTABLE_STATUSES =
            EnumSet.of(TicketStatus.OPEN, TicketStatus.IN_PROGRESS);

    private final TicketRepository ticketRepository;
    private final TicketAttachmentRepository ticketAttachmentRepository;
    private final TicketSettlementRepository ticketSettlementRepository;
    private final TicketCommentRepository ticketCommentRepository;
    private final CampusResourceService campusResourceService;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final NotificationService notificationService;

    @Transactional
    public Ticket create(User reporter, Long resourceId, String locationText, String title, String category,
                         String description, TicketPriority priority, String contactName, String contactEmail,
                         String contactPhone, List<MultipartFile> files) {
        CampusResource resource = null;
        if (resourceId != null) {
            resource = campusResourceService.get(resourceId);
        }
        String normalizedLocation = normalizeOptionalText(locationText, MAX_LOCATION_LENGTH, "INVALID_LOCATION");
        if (resource == null && normalizedLocation == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "LOCATION_REQUIRED",
                    "Provide a resource or a location description");
        }
        String normalizedTitle = normalizeRequiredText(
                title, "TITLE_REQUIRED", "Title is required", MAX_TITLE_LENGTH, "INVALID_TITLE");
        String normalizedCategory = normalizeRequiredText(
                category, "CATEGORY_REQUIRED", "Category is required", MAX_CATEGORY_LENGTH, "INVALID_CATEGORY");
        String normalizedDescription = normalizeRequiredText(
                description, "DESCRIPTION_REQUIRED", "Description is required", MAX_TICKET_DESCRIPTION_LENGTH,
                "INVALID_DESCRIPTION");
        assertTicketDescriptionNoWhitespace(normalizedDescription);
        String normalizedContactName = normalizeRequiredText(
                contactName, "CONTACT_NAME_REQUIRED", "Contact name is required", MAX_CONTACT_NAME_LENGTH,
                "INVALID_CONTACT_NAME");
        if (!CONTACT_NAME_LETTERS.matcher(normalizedContactName).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTACT_NAME",
                    "Contact name must contain only letters, spaces, and . ' - characters");
        }
        String normalizedEmail = normalizeRequiredText(
                contactEmail, "CONTACT_EMAIL_REQUIRED", "Contact email is required", MAX_CONTACT_EMAIL_LENGTH,
                "INVALID_CONTACT_EMAIL");
        if (!SIMPLE_EMAIL.matcher(normalizedEmail).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTACT_EMAIL", "Contact email format is invalid");
        }
        if (!EMAIL_ALLOWED_CHARS.matcher(normalizedEmail).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTACT_EMAIL",
                    "Contact email may contain only letters, numbers, @ and .");
        }
        String normalizedPhone = normalizeRequiredText(
                contactPhone, "CONTACT_PHONE_REQUIRED", "Contact phone is required", MAX_CONTACT_PHONE_LENGTH,
                "INVALID_CONTACT_PHONE");
        if (!PHONE_DIGITS_ONLY.matcher(normalizedPhone).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTACT_PHONE",
                    "Contact phone must be exactly 10 digits");
        }
        Ticket t = Ticket.builder()
                .reporter(reporter)
                .resource(resource)
                .locationText(normalizedLocation)
                .title(normalizedTitle)
                .category(normalizedCategory)
                .description(normalizedDescription)
                .priority(priority != null ? priority : TicketPriority.MEDIUM)
                .contactName(normalizedContactName)
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

    @Transactional
    public Ticket updateTicketDetailsAsReporter(User reporter, Long ticketId, String locationText, String title,
                                                String category, String description, TicketPriority priority,
                                                String contactName, String contactEmail, String contactPhone,
                                                boolean replaceAttachments, List<MultipartFile> files) {
        Ticket t = get(ticketId);
        assertReporterOwnsAndCanMutate(reporter, t);
        if (files != null && files.size() > MAX_ATTACHMENTS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TOO_MANY_FILES", "Maximum 3 images per ticket");
        }

        String normalizedLocation = normalizeOptionalText(locationText, MAX_LOCATION_LENGTH, "INVALID_LOCATION");
        if (normalizedLocation == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "LOCATION_REQUIRED", "Location is required");
        }
        String normalizedTitle = normalizeRequiredText(
                title, "TITLE_REQUIRED", "Title is required", MAX_TITLE_LENGTH, "INVALID_TITLE");
        String normalizedCategory = normalizeRequiredText(
                category, "CATEGORY_REQUIRED", "Category is required", MAX_CATEGORY_LENGTH, "INVALID_CATEGORY");
        String normalizedDescription = normalizeRequiredText(
                description, "DESCRIPTION_REQUIRED", "Description is required", MAX_TICKET_DESCRIPTION_LENGTH,
                "INVALID_DESCRIPTION");
        assertTicketDescriptionNoWhitespace(normalizedDescription);
        String normalizedContactName = normalizeRequiredText(
                contactName, "CONTACT_NAME_REQUIRED", "Contact name is required", MAX_CONTACT_NAME_LENGTH,
                "INVALID_CONTACT_NAME");
        if (!CONTACT_NAME_LETTERS.matcher(normalizedContactName).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTACT_NAME",
                    "Contact name must contain only letters, spaces, and . ' - characters");
        }
        String normalizedEmail = normalizeRequiredText(
                contactEmail, "CONTACT_EMAIL_REQUIRED", "Contact email is required", MAX_CONTACT_EMAIL_LENGTH,
                "INVALID_CONTACT_EMAIL");
        if (!SIMPLE_EMAIL.matcher(normalizedEmail).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTACT_EMAIL", "Contact email format is invalid");
        }
        if (!EMAIL_ALLOWED_CHARS.matcher(normalizedEmail).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTACT_EMAIL",
                    "Contact email may contain only letters, numbers, @ and .");
        }
        String normalizedPhone = normalizeRequiredText(
                contactPhone, "CONTACT_PHONE_REQUIRED", "Contact phone is required", MAX_CONTACT_PHONE_LENGTH,
                "INVALID_CONTACT_PHONE");
        if (!PHONE_DIGITS_ONLY.matcher(normalizedPhone).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTACT_PHONE",
                    "Contact phone must be exactly 10 digits");
        }

        t.setLocationText(normalizedLocation);
        t.setTitle(normalizedTitle);
        t.setCategory(normalizedCategory);
        t.setDescription(normalizedDescription);
        t.setPriority(priority != null ? priority : TicketPriority.MEDIUM);
        t.setContactName(normalizedContactName);
        t.setContactEmail(normalizedEmail);
        t.setContactPhone(normalizedPhone);
        ticketRepository.save(t);

        if (replaceAttachments) {
            removeTicketAttachmentsAndFiles(ticketId);
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
        }
        return ticketRepository.findById(t.getId()).orElseThrow();
    }

    @Transactional
    public void deleteTicketAsReporter(User reporter, Long ticketId) {
        Ticket t = get(ticketId);
        assertReporterOwnsAndCanMutate(reporter, t);
        removeTicketAttachmentsAndFiles(ticketId);
        removeTicketSettlement(ticketId);
        ticketCommentRepository.deleteByTicket_Id(ticketId);
        ticketRepository.delete(t);
    }

    @Transactional
    public void deleteTicketAsAdmin(User admin, Long ticketId) {
        if (admin.getRole() != UserRole.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Admin only");
        }
        Ticket t = get(ticketId);
        removeTicketAttachmentsAndFiles(ticketId);
        removeTicketSettlement(ticketId);
        ticketCommentRepository.deleteByTicket_Id(ticketId);
        ticketRepository.delete(t);
    }

    private void assertReporterOwnsAndCanMutate(User user, Ticket t) {
        if (!t.getReporter().getId().equals(user.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You can only change your own tickets");
        }
        if (!REPORTER_MUTABLE_STATUSES.contains(t.getStatus())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NOT_EDITABLE",
                    "This ticket can no longer be edited or deleted");
        }
    }

    private void removeTicketAttachmentsAndFiles(Long ticketId) {
        List<TicketAttachment> list = ticketAttachmentRepository.findByTicket_IdOrderByIdAsc(ticketId);
        for (TicketAttachment a : list) {
            try {
                Files.deleteIfExists(Path.of(a.getStoredPath()));
            } catch (IOException ignored) {
                /* best-effort */
            }
            ticketAttachmentRepository.delete(a);
        }
    }

    private void removeTicketSettlement(Long ticketId) {
        ticketSettlementRepository.findByTicket_Id(ticketId).ifPresent(s -> {
            try {
                if (s.getBeforeStoredPath() != null) {
                    Files.deleteIfExists(Path.of(s.getBeforeStoredPath()));
                }
                if (s.getAfterStoredPath() != null) {
                    Files.deleteIfExists(Path.of(s.getAfterStoredPath()));
                }
            } catch (IOException ignored) {
                /* best-effort */
            }
            ticketSettlementRepository.delete(s);
        });
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
        return ticketCommentRepository.findByTicket_IdOrderByCreatedAtAsc(ticketId);
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
        return ticketAttachmentRepository.findByTicket_IdOrderByIdAsc(ticketId);
    }

    public void assertCanReadTicket(User user, Ticket t) {
        boolean staff = user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.TECHNICIAN;
        boolean reporter = t.getReporter().getId().equals(user.getId());
        boolean assignee = t.getAssignedTo() != null && t.getAssignedTo().getId().equals(user.getId());
        if (!staff && !reporter && !assignee) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cannot access this ticket");
        }
    }

    private static void assertTicketDescriptionNoWhitespace(String description) {
        if (description.chars().anyMatch(Character::isWhitespace)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DESCRIPTION",
                    "Description must not contain spaces or line breaks");
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
