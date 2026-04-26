package com.smartcampus.hub.repository;

import com.smartcampus.hub.domain.ResourceStatus;
import com.smartcampus.hub.domain.ResourceType;
import com.smartcampus.hub.entity.CampusResource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CampusResourceRepository extends JpaRepository<CampusResource, Long>,
        JpaSpecificationExecutor<CampusResource> {

    long countByTypeAndStatus(ResourceType type, ResourceStatus status);
}
