package com.smartcampus.hub.repository;

import com.smartcampus.hub.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    List<Ticket> findByReporterIdOrderByCreatedAtDesc(Long reporterId);

    List<Ticket> findByAssignedToIdOrderByCreatedAtDesc(Long assigneeId);

    List<Ticket> findAllByOrderByCreatedAtDesc();
}
