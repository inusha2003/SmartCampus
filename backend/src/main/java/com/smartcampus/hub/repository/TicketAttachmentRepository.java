package com.smartcampus.hub.repository;

import com.smartcampus.hub.entity.TicketAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketAttachmentRepository extends JpaRepository<TicketAttachment, Long> {

    long countByTicketId(Long ticketId);

    List<TicketAttachment> findByTicketId(Long ticketId);
}
