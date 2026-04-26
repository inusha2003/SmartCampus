package com.smartcampus.hub.service;

import com.smartcampus.hub.domain.UserRole;
import com.smartcampus.hub.dto.TicketSettlementDto;
import com.smartcampus.hub.entity.Ticket;
import com.smartcampus.hub.entity.TicketSettlement;
import com.smartcampus.hub.entity.User;
import com.smartcampus.hub.exception.ApiException;
import com.smartcampus.hub.repository.TicketRepository;
import com.smartcampus.hub.repository.TicketSettlementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
@RequiredArgsConstructor
public class TicketSettlementService {

    private final TicketRepository ticketRepository;
    private final TicketSettlementRepository settlementRepository;
    private final FileStorageService fileStorageService;

    private static String beforeDownloadPath(long ticketId) {
        return "/api/tickets/" + ticketId + "/settlement/before/download";
    }

    private static String afterDownloadPath(long ticketId) {
        return "/api/tickets/" + ticketId + "/settlement/after/download";
    }

    private static void deleteStoredQuietly(String storedPath) {
        if (storedPath == null || storedPath.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(Path.of(storedPath));
        } catch (IOException ignored) {
            /* best-effort */
        }
    }

    private static void assertCanReadTicket(User user, Ticket t) {
        boolean staff = user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.TECHNICIAN;
        boolean reporter = t.getReporter().getId().equals(user.getId());
        boolean assignee = t.getAssignedTo() != null && t.getAssignedTo().getId().equals(user.getId());
        if (!staff && !reporter && !assignee) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cannot access this ticket");
        }
    }

    private static void assertAssigneeTechnician(User user, Ticket t) {
        if (user.getRole() != UserRole.TECHNICIAN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN",
                    "Only technicians assigned to this ticket can upload settlement photos");
        }
        if (t.getAssignedTo() == null || !t.getAssignedTo().getId().equals(user.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_ASSIGNED",
                    "You must be assigned to this ticket to upload settlement photos");
        }
    }

    private TicketSettlementDto emptyDto(long ticketId) {
        return new TicketSettlementDto(ticketId, false, false,
                beforeDownloadPath(ticketId), afterDownloadPath(ticketId),
                null, null, null);
    }

    private TicketSettlementDto toDto(TicketSettlement s) {
        long tid = s.getTicket().getId();
        boolean before = s.getBeforeStoredPath() != null && !s.getBeforeStoredPath().isBlank();
        boolean after = s.getAfterStoredPath() != null && !s.getAfterStoredPath().isBlank();
        String updated = s.getUpdatedAt() != null ? s.getUpdatedAt().toString() : null;
        return new TicketSettlementDto(tid, before, after,
                beforeDownloadPath(tid), afterDownloadPath(tid),
                s.getBeforeOriginalFilename(),
                s.getAfterOriginalFilename(),
                updated);
    }

    @Transactional(readOnly = true)
    public TicketSettlementDto getForViewer(User viewer, Long ticketId) {
        Ticket t = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Ticket not found"));
        assertCanReadTicket(viewer, t);
        return settlementRepository.findByTicket_Id(ticketId)
                .map(this::toDto)
                .orElseGet(() -> emptyDto(ticketId));
    }

    @Transactional
    public TicketSettlementDto upload(User user, Long ticketId, MultipartFile beforeImage, MultipartFile afterImage) {
        Ticket t = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Ticket not found"));
        assertCanReadTicket(user, t);
        assertAssigneeTechnician(user, t);

        boolean hasBefore = beforeImage != null && !beforeImage.isEmpty();
        boolean hasAfter = afterImage != null && !afterImage.isEmpty();
        if (!hasBefore && !hasAfter) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NO_FILE", "Provide a before image, an after image, or both.");
        }

        Ticket ticketRef = ticketRepository.getReferenceById(ticketId);
        TicketSettlement s = settlementRepository.findByTicket_Id(ticketId)
                .orElseGet(() -> settlementRepository.save(TicketSettlement.builder().ticket(ticketRef).build()));

        if (hasBefore) {
            deleteStoredQuietly(s.getBeforeStoredPath());
            String path = fileStorageService.storeTicketSettlement(ticketId, beforeImage);
            s.setBeforeStoredPath(path);
            s.setBeforeOriginalFilename(beforeImage.getOriginalFilename());
            s.setBeforeContentType(beforeImage.getContentType());
        }
        if (hasAfter) {
            deleteStoredQuietly(s.getAfterStoredPath());
            String path = fileStorageService.storeTicketSettlement(ticketId, afterImage);
            s.setAfterStoredPath(path);
            s.setAfterOriginalFilename(afterImage.getOriginalFilename());
            s.setAfterContentType(afterImage.getContentType());
        }

        return toDto(settlementRepository.save(s));
    }

    public record SettlementFile(Resource resource, MediaType mediaType, String filename) {
    }

    @Transactional(readOnly = true)
    public SettlementFile loadImage(User viewer, Long ticketId, boolean beforeSlot) {
        Ticket t = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Ticket not found"));
        assertCanReadTicket(viewer, t);
        TicketSettlement s = settlementRepository.findByTicket_Id(ticketId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "No settlement photos for this ticket"));
        String pathStr = beforeSlot ? s.getBeforeStoredPath() : s.getAfterStoredPath();
        String filename = beforeSlot ? s.getBeforeOriginalFilename() : s.getAfterOriginalFilename();
        String contentType = beforeSlot ? s.getBeforeContentType() : s.getAfterContentType();
        if (pathStr == null || pathStr.isBlank()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Image not uploaded");
        }
        Path path = Path.of(pathStr);
        if (!Files.exists(path)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "MISSING_FILE", "File no longer on disk");
        }
        MediaType mt = contentType != null
                ? MediaType.parseMediaType(contentType)
                : MediaType.APPLICATION_OCTET_STREAM;
        String safeName = filename != null ? filename.replace("\"", "") : "image";
        return new SettlementFile(new FileSystemResource(path), mt, safeName);
    }
}
