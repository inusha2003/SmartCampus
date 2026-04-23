package com.smartcampus.hub.service;

import com.smartcampus.hub.domain.BookingStatus;
import com.smartcampus.hub.domain.NotificationType;
import com.smartcampus.hub.domain.ResourceStatus;
import com.smartcampus.hub.domain.UserRole;
import com.smartcampus.hub.entity.Booking;
import com.smartcampus.hub.entity.CampusResource;
import com.smartcampus.hub.entity.User;
import com.smartcampus.hub.exception.ApiException;
import com.smartcampus.hub.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class BookingService {

    private static final int MAX_PURPOSE_LENGTH = 500;
    private static final long MAX_BOOKING_HOURS = 12;
    private static final int MINUTES_PER_DAY = 24 * 60;
    private static final Pattern SINGLE_DAY_WINDOW = Pattern.compile(
        "^(MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)\\s+(\\d{1,2}:\\d{2})\\s*-\\s*(\\d{1,2}:\\d{2})$",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern DAY_RANGE_WINDOW = Pattern.compile(
        "^(MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)\\s*-\\s*(MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)\\s+(\\d{1,2}:\\d{2})\\s*-\\s*(\\d{1,2}:\\d{2})$",
        Pattern.CASE_INSENSITIVE);

    private final BookingRepository bookingRepository;
    private final CampusResourceService campusResourceService;
    private final NotificationService notificationService;

    @Transactional
    public Booking create(User requester, Long resourceId, Instant startAt, Instant endAt,
                          String purpose, Integer expectedAttendees) {
        if (startAt == null || endAt == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RANGE", "Start and end times are required");
        }
        if (!endAt.isAfter(startAt)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RANGE", "End time must be after start time");
        }
        if (startAt.isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_START_TIME", "Start time cannot be in the past. Please select a future date and time.");
        }
        if (endAt.isAfter(startAt.plusSeconds(MAX_BOOKING_HOURS * 3600))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DURATION",
                    "Booking duration cannot exceed " + MAX_BOOKING_HOURS + " hours");
        }
        CampusResource resource = campusResourceService.get(resourceId);
        if (resource.getStatus() != ResourceStatus.ACTIVE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "RESOURCE_UNAVAILABLE", "Resource is not bookable");
        }
        validateAgainstAvailabilityWindows(resource, startAt, endAt);
        if (expectedAttendees != null && expectedAttendees <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ATTENDEES", "Expected attendees must be greater than 0");
        }
        if (expectedAttendees != null && resource.getCapacity() != null && expectedAttendees > resource.getCapacity()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EXCEEDS_CAPACITY",
                    "Expected attendees cannot exceed resource capacity (" + resource.getCapacity() + ")");
        }
        String normalizedPurpose = normalizeOptionalText(purpose, MAX_PURPOSE_LENGTH, "INVALID_PURPOSE");
        if (bookingRepository.existsOverlapping(resourceId, startAt, endAt, null)) {
            throw new ApiException(HttpStatus.CONFLICT, "SCHEDULE_CONFLICT",
                    "This resource is already booked for an overlapping time");
        }
        Booking b = Booking.builder()
                .requester(requester)
                .resource(resource)
                .startAt(startAt)
                .endAt(endAt)
                .purpose(normalizedPurpose)
                .expectedAttendees(expectedAttendees)
                .status(BookingStatus.PENDING)
                .build();
        return bookingRepository.save(b);
    }

    @Transactional(readOnly = true)
    public List<Booking> listMine(User user) {
        return bookingRepository.findByRequesterIdOrderByStartAtDesc(user.getId());
    }

    @Transactional(readOnly = true)
    public List<Booking> listAllForAdmin(BookingStatus status) {
        if (status != null) {
            return bookingRepository.findByStatusOrderByStartAtAsc(status);
        }
        return bookingRepository.findAll().stream()
                .sorted(java.util.Comparator.comparing(Booking::getStartAt))
                .toList();
    }

    @Transactional
    public Booking decide(User admin, Long bookingId, boolean approve, String reason) {
        if (admin.getRole() != UserRole.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Admin only");
        }
        String normalizedReason = normalizeOptionalText(reason, 500, "INVALID_REASON");
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Booking not found"));
        if (b.getStatus() != BookingStatus.PENDING) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STATE", "Booking is not pending");
        }
        if (approve) {
            if (bookingRepository.existsOverlapping(b.getResource().getId(), b.getStartAt(), b.getEndAt(), b.getId())) {
                throw new ApiException(HttpStatus.CONFLICT, "SCHEDULE_CONFLICT",
                        "Another booking was approved for this slot");
            }
            b.setStatus(BookingStatus.APPROVED);
            b.setDecisionReason(normalizedReason);
        } else {
            if (normalizedReason == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "REASON_REQUIRED", "Rejection reason is required");
            }
            b.setStatus(BookingStatus.REJECTED);
            b.setDecisionReason(normalizedReason);
        }
        bookingRepository.save(b);
        notificationService.notify(
                b.getRequester(),
                NotificationType.BOOKING_DECISION,
                approve ? "Booking approved" : "Booking rejected",
                "Your booking for " + b.getResource().getName() + " was "
                        + (approve ? "approved" : "rejected")
                        + (normalizedReason != null ? (": " + normalizedReason) : ""),
                "BOOKING",
                b.getId());
        return b;
    }

    @Transactional
    public Booking cancel(User user, Long bookingId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Booking not found"));
        if (!b.getRequester().getId().equals(user.getId()) && user.getRole() != UserRole.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Not your booking");
        }
        if (b.getStatus() != BookingStatus.APPROVED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STATE", "Only approved bookings can be cancelled");
        }
        b.setStatus(BookingStatus.CANCELLED);
        return bookingRepository.save(b);
    }

    private String normalizeOptionalText(String value, int maxLen, String errorCode) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > maxLen) {
            throw new ApiException(HttpStatus.BAD_REQUEST, errorCode, "Text exceeds maximum length of " + maxLen);
        }
        return trimmed;
    }

    private void validateAgainstAvailabilityWindows(CampusResource resource, Instant startAt, Instant endAt) {
        Map<DayOfWeek, List<TimeWindow>> windowsByDay = parseAvailabilityWindows(resource.getAvailabilityWindows());
        if (windowsByDay == null || windowsByDay.isEmpty()) {
            return;
        }
        ZoneId zone = ZoneId.systemDefault();
        ZonedDateTime cursor = startAt.atZone(zone);
        ZonedDateTime end = endAt.atZone(zone);

        while (cursor.isBefore(end)) {
            ZonedDateTime endOfDay = cursor.toLocalDate().plusDays(1).atStartOfDay(zone);
            ZonedDateTime segmentEnd = endOfDay.isBefore(end) ? endOfDay : end;
            DayOfWeek day = cursor.getDayOfWeek();
            int startMinute = toMinuteOfDay(cursor.toLocalTime());
            int endMinute = segmentEnd.toLocalDate().isAfter(cursor.toLocalDate())
                    ? MINUTES_PER_DAY
                    : toMinuteOfDay(segmentEnd.toLocalTime());

            List<TimeWindow> windows = windowsByDay.get(day);
            boolean covered = windows != null && windows.stream()
                    .anyMatch(window -> startMinute >= window.startMinute() && endMinute <= window.endMinute());
            if (!covered) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "OUTSIDE_AVAILABILITY_WINDOWS",
                        "Booking must be within configured availability windows");
            }
            cursor = segmentEnd;
        }
    }

    private Map<DayOfWeek, List<TimeWindow>> parseAvailabilityWindows(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value
                .replace('\u2013', '-')
                .replace('\u2014', '-');
        String[] segments = normalized.split("[;\\n]");
        Map<DayOfWeek, List<TimeWindow>> windowsByDay = new EnumMap<>(DayOfWeek.class);
        boolean parsedAtLeastOne = false;

        for (String raw : segments) {
            String segment = raw.trim();
            if (segment.isEmpty()) {
                continue;
            }
            Matcher dayRangeMatch = DAY_RANGE_WINDOW.matcher(segment);
            if (dayRangeMatch.matches()) {
                DayOfWeek startDay = parseDay(dayRangeMatch.group(1));
                DayOfWeek endDay = parseDay(dayRangeMatch.group(2));
                TimeWindow window = parseWindow(dayRangeMatch.group(3), dayRangeMatch.group(4));
                if (startDay == null || endDay == null || window == null) {
                    return null;
                }
                for (DayOfWeek day : expandDays(startDay, endDay)) {
                    windowsByDay.computeIfAbsent(day, ignored -> new ArrayList<>()).add(window);
                }
                parsedAtLeastOne = true;
                continue;
            }

            Matcher singleDayMatch = SINGLE_DAY_WINDOW.matcher(segment);
            if (singleDayMatch.matches()) {
                DayOfWeek day = parseDay(singleDayMatch.group(1));
                TimeWindow window = parseWindow(singleDayMatch.group(2), singleDayMatch.group(3));
                if (day == null || window == null) {
                    return null;
                }
                windowsByDay.computeIfAbsent(day, ignored -> new ArrayList<>()).add(window);
                parsedAtLeastOne = true;
                continue;
            }

            return null;
        }

        if (!parsedAtLeastOne) {
            return null;
        }
        windowsByDay.values().forEach(dayWindows -> dayWindows.sort(Comparator.comparingInt(TimeWindow::startMinute)));
        return windowsByDay;
    }

    private List<DayOfWeek> expandDays(DayOfWeek startDay, DayOfWeek endDay) {
        List<DayOfWeek> days = new ArrayList<>();
        DayOfWeek cursor = startDay;
        while (true) {
            days.add(cursor);
            if (cursor == endDay) {
                return days;
            }
            cursor = cursor.plus(1);
        }
    }

    private DayOfWeek parseDay(String token) {
        String normalized = token.trim().toUpperCase();
        return switch (normalized) {
            case "MON", "MONDAY" -> DayOfWeek.MONDAY;
            case "TUE", "TUESDAY" -> DayOfWeek.TUESDAY;
            case "WED", "WEDNESDAY" -> DayOfWeek.WEDNESDAY;
            case "THU", "THURSDAY" -> DayOfWeek.THURSDAY;
            case "FRI", "FRIDAY" -> DayOfWeek.FRIDAY;
            case "SAT", "SATURDAY" -> DayOfWeek.SATURDAY;
            case "SUN", "SUNDAY" -> DayOfWeek.SUNDAY;
            default -> null;
        };
    }

    private TimeWindow parseWindow(String startText, String endText) {
        LocalTime start = parseTime(startText);
        LocalTime end = parseTime(endText);
        if (start == null || end == null) {
            return null;
        }
        int startMinute = toMinuteOfDay(start);
        int endMinute = toMinuteOfDay(end);
        if (endMinute <= startMinute) {
            return null;
        }
        return new TimeWindow(startMinute, endMinute);
    }

    private LocalTime parseTime(String value) {
        try {
            return LocalTime.parse(value.trim());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private int toMinuteOfDay(LocalTime time) {
        return time.getHour() * 60 + time.getMinute();
    }

    private record TimeWindow(int startMinute, int endMinute) {
    }
}
