package com.smartcampus.hub.controller;

import com.smartcampus.hub.domain.TicketPriority;
import com.smartcampus.hub.dto.*;
import com.smartcampus.hub.entity.Ticket;
import com.smartcampus.hub.entity.TicketAttachment;
import com.smartcampus.hub.exception.ApiException;
import com.smartcampus.hub.repository.TicketAttachmentRepository;
import com.smartcampus.hub.security.CurrentUser;
import com.smartcampus.hub.service.TicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketService ticketService;
    private final TicketAttachmentRepository ticketAttachmentRepository;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public TicketDto create(
            @RequestParam(required = false) Long resourceId,
            @RequestParam(required = false) String locationText,
            @RequestParam String category,
            @RequestParam String description,
            @RequestParam(required = false) TicketPriority priority,
            @RequestParam(required = false) String contactEmail,
            @RequestParam(required = false) String contactPhone,
            @RequestParam(name = "files", required = false) List<MultipartFile> files) {
        if (files != null && files.size() > 3) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TOO_MANY_FILES", "Maximum 3 images per ticket");
        }
        Ticket created = ticketService.create(
                CurrentUser.requireUser(),
                resourceId,
                locationText,
                category,
                description,
                priority,
                contactEmail,
                contactPhone,
                files);
        return toDto(created);
    }

    @GetMapping("/mine")
    public List<TicketDto> mine() {
        return toDtoList(ticketService.listMine(CurrentUser.requireUser()));
    }

    @GetMapping
    public List<TicketDto> list() {
        return toDtoList(ticketService.listAssignable(CurrentUser.requireUser()));
    }

    @GetMapping("/{id}")
    public TicketDto get(@PathVariable Long id) {
        Ticket t = ticketService.get(id);
        ticketService.assertCanReadTicket(CurrentUser.requireUser(), t);
        return toDto(t);
    }

    @PutMapping("/{id}")
    public TicketDto update(@PathVariable Long id, @Valid @RequestBody UpdateTicketRequest req) {
        Ticket t = ticketService.updateTicket(
                CurrentUser.requireUser(),
                id,
                req.status(),
                req.assigneeUserId(),
                req.resolutionNotes(),
                req.rejectReason());
        return toDto(t);
    }

    @GetMapping("/{id}/comments")
    public List<CommentDto> comments(@PathVariable Long id) {
        Ticket t = ticketService.get(id);
        ticketService.assertCanReadTicket(CurrentUser.requireUser(), t);
        return ticketService.listComments(id).stream().map(CommentDto::from).toList();
    }

    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentDto addComment(@PathVariable Long id, @RequestBody java.util.Map<String, String> body) {
        String text = body.get("body");
        if (text == null || text.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BODY", "Comment body required");
        }
        return CommentDto.from(ticketService.addComment(CurrentUser.requireUser(), id, text.trim()));
    }

    @PatchMapping("/{ticketId}/comments/{commentId}")
    public CommentDto editComment(
            @PathVariable Long ticketId,
            @PathVariable Long commentId,
            @RequestBody java.util.Map<String, String> body) {
        String text = body.get("body");
        if (text == null || text.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BODY", "Comment body required");
        }
        return CommentDto.from(ticketService.editComment(
                CurrentUser.requireUser(), ticketId, commentId, text.trim()));
    }

    @DeleteMapping("/{ticketId}/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@PathVariable Long ticketId, @PathVariable Long commentId) {
        ticketService.deleteComment(CurrentUser.requireUser(), ticketId, commentId);
    }

    @GetMapping("/{id}/attachments")
    public List<AttachmentDto> attachments(@PathVariable Long id) {
        Ticket t = ticketService.get(id);
        ticketService.assertCanReadTicket(CurrentUser.requireUser(), t);
        return ticketService.listAttachments(id).stream().map(AttachmentDto::from).toList();
    }

    @GetMapping("/{ticketId}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> download(
            @PathVariable Long ticketId,
            @PathVariable Long attachmentId) {
        Ticket t = ticketService.get(ticketId);
        ticketService.assertCanReadTicket(CurrentUser.requireUser(), t);
        TicketAttachment att = ticketAttachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Attachment not found"));
        if (!att.getTicket().getId().equals(ticketId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Attachment not found");
        }
        Path path = Path.of(att.getStoredPath());
        if (!java.nio.file.Files.exists(path)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "MISSING_FILE", "File no longer on disk");
        }
        FileSystemResource resource = new FileSystemResource(path);
        MediaType mt = att.getContentType() != null
                ? MediaType.parseMediaType(att.getContentType())
                : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + att.getOriginalFilename().replace("\"", "") + "\"")
                .contentType(mt)
                .body(resource);
    }

    private TicketDto toDto(Ticket t) {
        List<AttachmentDto> att = ticketAttachmentRepository.findByTicketId(t.getId()).stream()
                .map(AttachmentDto::from)
                .toList();
        return TicketDto.from(t, att);
    }

    private List<TicketDto> toDtoList(List<Ticket> tickets) {
        if (tickets.isEmpty()) {
            return List.of();
        }
        List<Long> ids = tickets.stream().map(Ticket::getId).toList();
        List<TicketAttachment> all = ticketAttachmentRepository.findAllByTicketIdIn(ids);
        Map<Long, List<AttachmentDto>> byTicket = new HashMap<>();
        for (TicketAttachment a : all) {
            Long tid = a.getTicket().getId();
            byTicket.computeIfAbsent(tid, k -> new ArrayList<>()).add(AttachmentDto.from(a));
        }
        return tickets.stream()
                .map(t -> TicketDto.from(t, byTicket.getOrDefault(t.getId(), List.of())))
                .toList();
    }
}
