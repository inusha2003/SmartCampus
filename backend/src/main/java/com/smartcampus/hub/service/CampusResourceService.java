package com.smartcampus.hub.service;

import com.smartcampus.hub.domain.ResourceStatus;
import com.smartcampus.hub.domain.ResourceType;
import com.smartcampus.hub.entity.CampusResource;
import com.smartcampus.hub.exception.ApiException;
import com.smartcampus.hub.repository.CampusResourceRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CampusResourceService {

    private static final int MAX_NAME_LENGTH = 120;
    private static final int MAX_LOCATION_LENGTH = 200;
    private static final int MAX_WINDOWS_LENGTH = 2000;

    private final CampusResourceRepository campusResourceRepository;

    @Transactional(readOnly = true)
    public List<CampusResource> search(ResourceType type, Integer minCapacity, String location,
                                        ResourceStatus status) {
        if (minCapacity != null && minCapacity < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CAPACITY", "Minimum capacity cannot be negative");
        }
        Specification<CampusResource> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (type != null) {
                p.add(cb.equal(root.get("type"), type));
            }
            if (minCapacity != null) {
                p.add(cb.greaterThanOrEqualTo(root.get("capacity"), minCapacity));
            }
            if (StringUtils.hasText(location)) {
                p.add(cb.like(cb.lower(root.get("location")), "%" + location.toLowerCase() + "%"));
            }
            if (status != null) {
                p.add(cb.equal(root.get("status"), status));
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
        return campusResourceRepository.findAll(spec);
    }

    @Transactional(readOnly = true)
    public CampusResource get(Long id) {
        return campusResourceRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found"));
    }

    @Transactional
    public CampusResource create(CampusResource r) {
        validateAndNormalize(r, true);
        return campusResourceRepository.save(r);
    }

    @Transactional
    public CampusResource update(Long id, CampusResource patch) {
        CampusResource existing = get(id);
        if (patch.getName() != null) {
            existing.setName(normalizeRequiredText(patch.getName(), "NAME_REQUIRED", "Resource name is required", MAX_NAME_LENGTH, "INVALID_NAME"));
        }
        if (patch.getType() != null) {
            existing.setType(patch.getType());
        }
        if (patch.getCapacity() != null) {
            if (patch.getCapacity() < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CAPACITY", "Capacity cannot be negative");
            }
            existing.setCapacity(patch.getCapacity());
        }
        if (patch.getLocation() != null) {
            existing.setLocation(normalizeRequiredText(patch.getLocation(), "LOCATION_REQUIRED", "Location is required", MAX_LOCATION_LENGTH, "INVALID_LOCATION"));
        }
        if (patch.getAvailabilityWindows() != null) {
            existing.setAvailabilityWindows(normalizeOptionalText(
                    patch.getAvailabilityWindows(), MAX_WINDOWS_LENGTH, "INVALID_WINDOWS"));
        }
        if (patch.getStatus() != null) {
            existing.setStatus(patch.getStatus());
        }
        return campusResourceRepository.save(existing);
    }

    @Transactional
    public void delete(Long id) {
        if (!campusResourceRepository.existsById(id)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found");
        }
        campusResourceRepository.deleteById(id);
    }

    private void validateAndNormalize(CampusResource resource, boolean requireMandatory) {
        if (requireMandatory || resource.getName() != null) {
            resource.setName(normalizeRequiredText(
                    resource.getName(), "NAME_REQUIRED", "Resource name is required", MAX_NAME_LENGTH, "INVALID_NAME"));
        }
        if (resource.getCapacity() != null && resource.getCapacity() < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CAPACITY", "Capacity cannot be negative");
        }
        if (requireMandatory || resource.getLocation() != null) {
            resource.setLocation(normalizeRequiredText(
                    resource.getLocation(), "LOCATION_REQUIRED", "Location is required", MAX_LOCATION_LENGTH, "INVALID_LOCATION"));
        }
        if (resource.getAvailabilityWindows() != null) {
            resource.setAvailabilityWindows(normalizeOptionalText(
                    resource.getAvailabilityWindows(), MAX_WINDOWS_LENGTH, "INVALID_WINDOWS"));
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
