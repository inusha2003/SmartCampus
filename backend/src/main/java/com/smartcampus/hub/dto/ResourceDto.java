package com.smartcampus.hub.dto;

import com.smartcampus.hub.domain.ResourceStatus;
import com.smartcampus.hub.domain.ResourceType;
import com.smartcampus.hub.entity.CampusResource;

import java.time.Instant;

public record ResourceDto(
        Long id,
        String name,
        ResourceType type,
        Integer capacity,
        String location,
        String availabilityWindows,
        ResourceStatus status,
        Instant createdAt) {

    public static ResourceDto from(CampusResource r) {
        return new ResourceDto(
                r.getId(),
                r.getName(),
                r.getType(),
                r.getCapacity(),
                r.getLocation(),
                r.getAvailabilityWindows(),
                r.getStatus(),
                r.getCreatedAt());
    }
}
