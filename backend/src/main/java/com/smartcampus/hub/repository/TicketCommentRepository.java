package com.smartcampus.hub.repository;

import com.smartcampus.hub.entity.TicketComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketCommentRepository extends JpaRepository<TicketComment, Long> {

    List<TicketComment> findByTicket_IdOrderByCreatedAtAsc(Long ticketId);

    void deleteByTicket_Id(Long ticketId);
}
