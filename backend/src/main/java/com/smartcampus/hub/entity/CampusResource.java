package com.smartcampus.hub.entity;

import com.smartcampus.hub.domain.ResourceStatus;
import com.smartcampus.hub.domain.ResourceType;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "campus_resources")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CampusResource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ResourceType type;

    private Integer capacity;

    @Column(nullable = false)
    private String location;

    @Column(length = 2000)
    private String availabilityWindows;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ResourceStatus status = ResourceStatus.ACTIVE;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
