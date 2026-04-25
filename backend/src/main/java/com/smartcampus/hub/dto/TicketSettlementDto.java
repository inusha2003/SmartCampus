package com.smartcampus.hub.dto;

public record TicketSettlementDto(
        long ticketId,
        boolean beforePresent,
        boolean afterPresent,
        String beforeDownloadUrl,
        String afterDownloadUrl,
        String beforeFilename,
        String afterFilename,
        String updatedAt) {
}
