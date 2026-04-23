package com.smartcampus.hub.config;

import com.smartcampus.hub.domain.ResourceStatus;
import com.smartcampus.hub.domain.ResourceType;
import com.smartcampus.hub.entity.CampusResource;
import com.smartcampus.hub.entity.User;
import com.smartcampus.hub.domain.UserRole;
import com.smartcampus.hub.repository.CampusResourceRepository;
import com.smartcampus.hub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Profile("dev")
@Component
@RequiredArgsConstructor
public class DevDataLoader implements ApplicationRunner {

    private final CampusResourceRepository resourceRepository;
    private final UserRepository userRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (resourceRepository.count() == 0) {
            resourceRepository.save(CampusResource.builder()
                    .name("Main Lecture Hall A")
                    .type(ResourceType.LECTURE_HALL)
                    .capacity(200)
                    .location("Block A — Ground floor")
                    .availabilityWindows("Mon–Fri 08:00–18:00")
                    .status(ResourceStatus.ACTIVE)
                    .build());
            resourceRepository.save(CampusResource.builder()
                    .name("CS Lab 3")
                    .type(ResourceType.LAB)
                    .capacity(40)
                    .location("Computing Building — Floor 2")
                    .availabilityWindows("Mon–Sat 09:00–20:00")
                    .status(ResourceStatus.ACTIVE)
                    .build());
            resourceRepository.save(CampusResource.builder()
                    .name("Staff Meeting Room 12")
                    .type(ResourceType.MEETING_ROOM)
                    .capacity(12)
                    .location("Admin Wing")
                    .availabilityWindows("Business hours")
                    .status(ResourceStatus.ACTIVE)
                    .build());
            resourceRepository.save(CampusResource.builder()
                    .name("4K Projector Set B")
                    .type(ResourceType.EQUIPMENT)
                    .capacity(1)
                    .location("AV Store — Room 4")
                    .availabilityWindows("On request")
                    .status(ResourceStatus.ACTIVE)
                    .build());
        }
        userRepository.findByEmail("admin@campus.local").orElseGet(() ->
                userRepository.save(User.builder()
                        .email("admin@campus.local")
                        .displayName("Campus Admin")
                        .role(UserRole.ADMIN)
                        .oauthProvider("dev")
                        .oauthSubject("dev-admin@campus.local")
                        .build()));
        userRepository.findByEmail("tech@campus.local").orElseGet(() ->
                userRepository.save(User.builder()
                        .email("tech@campus.local")
                        .displayName("Technician")
                        .role(UserRole.TECHNICIAN)
                        .oauthProvider("dev")
                        .oauthSubject("dev-tech@campus.local")
                        .build()));
    }
}
