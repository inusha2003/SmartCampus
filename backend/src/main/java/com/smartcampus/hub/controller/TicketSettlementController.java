package com.smartcampus.hub.controller;

import com.smartcampus.hub.dto.TicketSettlementDto;
import com.smartcampus.hub.entity.User;
import com.smartcampus.hub.security.CurrentUser;
import com.smartcampus.hub.service.TicketSettlementService;
import com.smartcampus.hub.service.TicketSettlementService.SettlementFile;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/tickets/{ticketId}/settlement")
@RequiredArgsConstructor
public class TicketSettlementController {

    private final TicketSettlementService settlementService;

    @GetMapping
    public TicketSettlementDto get(@PathVariable Long ticketId) {
        User u = CurrentUser.requireUser();
        return settlementService.getForViewer(u, ticketId);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TicketSettlementDto upload(
            @PathVariable Long ticketId,
            @RequestPart(value = "beforeImage", required = false) MultipartFile beforeImage,
            @RequestPart(value = "afterImage", required = false) MultipartFile afterImage) {
        User u = CurrentUser.requireUser();
        return settlementService.upload(u, ticketId, beforeImage, afterImage);
    }

    @GetMapping("/before/download")
    public ResponseEntity<Resource> downloadBefore(@PathVariable Long ticketId) {
        return toResponse(settlementService.loadImage(CurrentUser.requireUser(), ticketId, true));
    }

    @GetMapping("/after/download")
    public ResponseEntity<Resource> downloadAfter(@PathVariable Long ticketId) {
        return toResponse(settlementService.loadImage(CurrentUser.requireUser(), ticketId, false));
    }

    private static ResponseEntity<Resource> toResponse(SettlementFile sf) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + sf.filename() + "\"")
                .contentType(sf.mediaType())
                .body(sf.resource());
    }
}
