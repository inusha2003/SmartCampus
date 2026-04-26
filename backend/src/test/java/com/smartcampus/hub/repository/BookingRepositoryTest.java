package com.smartcampus.hub.repository;

import com.smartcampus.hub.domain.BookingStatus;
import com.smartcampus.hub.domain.ResourceStatus;
import com.smartcampus.hub.domain.ResourceType;
import com.smartcampus.hub.entity.Booking;
import com.smartcampus.hub.entity.CampusResource;
import com.smartcampus.hub.entity.User;
import com.smartcampus.hub.domain.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class BookingRepositoryTest {

    @Autowired
    private BookingRepository bookingRepository;
    @Autowired
    private CampusResourceRepository campusResourceRepository;
    @Autowired
    private UserRepository userRepository;

    private CampusResource room;
    private User user;

    @BeforeEach
    void setup() {
        user = userRepository.save(User.builder()
                .email("u@test.com")
                .displayName("U")
                .role(UserRole.USER)
                .oauthProvider("dev")
                .oauthSubject("u1")
                .build());
        room = campusResourceRepository.save(CampusResource.builder()
                .name("Hall")
                .type(ResourceType.LECTURE_HALL)
                .capacity(50)
                .location("A")
                .status(ResourceStatus.ACTIVE)
                .build());
    }

    @Test
    void detectsOverlapForPendingBooking() {
        Instant start = Instant.parse("2026-05-01T10:00:00Z");
        Instant end = Instant.parse("2026-05-01T12:00:00Z");
        bookingRepository.save(Booking.builder()
                .requester(user)
                .resource(room)
                .startAt(start)
                .endAt(end)
                .status(BookingStatus.PENDING)
                .build());
        boolean overlap = bookingRepository.existsOverlapping(
                room.getId(),
                Instant.parse("2026-05-01T11:00:00Z"),
                Instant.parse("2026-05-01T13:00:00Z"),
                null);
        assertThat(overlap).isTrue();
    }

    @Test
    void noOverlapWhenRejected() {
        Instant start = Instant.parse("2026-05-01T10:00:00Z");
        Instant end = Instant.parse("2026-05-01T12:00:00Z");
        bookingRepository.save(Booking.builder()
                .requester(user)
                .resource(room)
                .startAt(start)
                .endAt(end)
                .status(BookingStatus.REJECTED)
                .build());
        boolean overlap = bookingRepository.existsOverlapping(
                room.getId(),
                start.plus(1, ChronoUnit.HOURS),
                end.plus(1, ChronoUnit.HOURS),
                null);
        assertThat(overlap).isFalse();
    }
}
