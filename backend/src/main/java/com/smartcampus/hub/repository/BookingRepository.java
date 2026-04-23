package com.smartcampus.hub.repository;

import com.smartcampus.hub.domain.BookingStatus;
import com.smartcampus.hub.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByRequesterIdOrderByStartAtDesc(Long requesterId);

    List<Booking> findByStatusOrderByStartAtAsc(BookingStatus status);

    @Query("""
            SELECT CASE WHEN COUNT(b) > 0 THEN true ELSE false END FROM Booking b
            WHERE b.resource.id = :resourceId
            AND b.status IN ('PENDING', 'APPROVED')
            AND (:excludeId IS NULL OR b.id <> :excludeId)
            AND b.startAt < :endAt AND b.endAt > :startAt
            """)
    boolean existsOverlapping(
            @Param("resourceId") Long resourceId,
            @Param("startAt") Instant startAt,
            @Param("endAt") Instant endAt,
            @Param("excludeId") Long excludeBookingId);
}
