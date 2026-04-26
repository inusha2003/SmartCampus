package com.smartcampus.hub.controller;

import com.smartcampus.hub.domain.ResourceStatus;
import com.smartcampus.hub.domain.ResourceType;
import com.smartcampus.hub.dto.CreateResourceRequest;
import com.smartcampus.hub.dto.ResourceDto;
import com.smartcampus.hub.entity.CampusResource;
import com.smartcampus.hub.service.CampusResourceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
@Validated
public class ResourceController {

    private final CampusResourceService campusResourceService;

    @GetMapping
    public List<ResourceDto> search(
            @RequestParam(required = false) ResourceType type,
            @RequestParam(required = false) @PositiveOrZero(message = "minCapacity cannot be negative") Integer minCapacity,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) ResourceStatus status) {
        return campusResourceService.search(type, minCapacity, location, status).stream()
                .map(ResourceDto::from)
                .toList();
    }

    @GetMapping("/{id}")
    public ResourceDto get(@PathVariable Long id) {
        return ResourceDto.from(campusResourceService.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceDto create(@Valid @RequestBody CreateResourceRequest req) {
        CampusResource r = CampusResource.builder()
                .name(req.name())
                .type(req.type())
                .capacity(req.capacity())
                .location(req.location())
                .availabilityWindows(req.availabilityWindows())
                .status(req.status() != null ? req.status() : ResourceStatus.ACTIVE)
                .build();
        return ResourceDto.from(campusResourceService.create(r));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceDto update(@PathVariable Long id, @RequestBody CampusResource patch) {
        return ResourceDto.from(campusResourceService.update(id, patch));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long id) {
        campusResourceService.delete(id);
    }
}
