package com.smartcampus.hub.controller;

import com.smartcampus.hub.domain.BookingStatus;
import com.smartcampus.hub.dto.BookingDecisionRequest;
import com.smartcampus.hub.dto.BookingDto;
import com.smartcampus.hub.dto.CreateBookingRequest;
import com.smartcampus.hub.dto.UpdateBookingRequest;
import com.smartcampus.hub.security.CurrentUser;
import com.smartcampus.hub.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BookingDto create(@Valid @RequestBody CreateBookingRequest req) {
        return BookingDto.from(bookingService.create(
                CurrentUser.requireUser(),
                req.resourceId(),
                req.startAt(),
                req.endAt(),
                req.purpose(),
                req.expectedAttendees()));
    }

    @PutMapping("/{id}")
    public BookingDto update(@PathVariable Long id, @Valid @RequestBody UpdateBookingRequest req) {
        return BookingDto.from(bookingService.update(
                CurrentUser.requireUser(),
                id,
                req.resourceId(),
                req.startAt(),
                req.endAt(),
                req.purpose(),
                req.expectedAttendees()));
    }

    @GetMapping("/mine")
    public List<BookingDto> mine() {
        return bookingService.listMine(CurrentUser.requireUser()).stream()
                .map(BookingDto::from)
                .toList();
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<BookingDto> listAll(@RequestParam(required = false) BookingStatus status) {
        return bookingService.listAllForAdmin(status).stream()
                .map(BookingDto::from)
                .toList();
    }

    @PutMapping("/{id}/decision")
    @PreAuthorize("hasRole('ADMIN')")
    public BookingDto decide(@PathVariable Long id, @Valid @RequestBody BookingDecisionRequest req) {
        return BookingDto.from(bookingService.decide(
                CurrentUser.requireUser(),
                id,
                Boolean.TRUE.equals(req.approve()),
                req.reason()));
    }

    /** Cancels an approved booking (soft status change). */
    @DeleteMapping("/{id}")
    public BookingDto cancel(@PathVariable Long id) {
        return BookingDto.from(bookingService.cancel(CurrentUser.requireUser(), id));
    }
}
