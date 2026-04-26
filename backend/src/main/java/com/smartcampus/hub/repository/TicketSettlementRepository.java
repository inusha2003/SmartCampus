package com.smartcampus.hub.repository;

import com.smartcampus.hub.entity.TicketSettlement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TicketSettlementRepository extends JpaRepository<TicketSettlement, Long> {

    Optional<TicketSettlement> findByTicket_Id(Long ticketId);

    void deleteByTicket_Id(Long ticketId);
}
