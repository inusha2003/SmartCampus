package com.smartcampus.hub.repository;

import com.smartcampus.hub.entity.TicketAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface TicketAttachmentRepository extends JpaRepository<TicketAttachment, Long> {

    long countByTicketId(Long ticketId);

    List<TicketAttachment> findByTicketId(Long ticketId);

    @Query("SELECT a FROM TicketAttachment a WHERE a.ticket.id IN :ids ORDER BY a.ticket.id ASC, a.id ASC")
    List<TicketAttachment> findAllByTicketIdIn(@Param("ids") Collection<Long> ids);
}
