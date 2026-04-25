package com.smartcampus.hub.service;

import com.smartcampus.hub.entity.Ticket;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class IssueEmailService {

    private static final Logger log = LoggerFactory.getLogger(IssueEmailService.class);
    private static final Pattern SIMPLE_EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${app.mail.from:no-reply@smartcampus.local}")
    private String fromAddress;
    /** Optional override recipient for testing (always receives solved emails). */
    @Value("${app.mail.force-to:}")
    private String forceRecipient;

    /**
     * When an admin marks a ticket CLOSED, notify the user. Prefers the ticket contact email (form),
     * and also sends to the reporter account email when different.
     */
    public void sendSolvedEmail(Ticket ticket) {
        if (ticket == null) {
            return;
        }
        Set<String> recipients = new LinkedHashSet<>();
        if (StringUtils.hasText(ticket.getContactEmail())) {
            String e = ticket.getContactEmail().trim();
            if (SIMPLE_EMAIL.matcher(e).matches()) {
                recipients.add(e);
            }
        }
        if (ticket.getReporter() != null && StringUtils.hasText(ticket.getReporter().getEmail())) {
            String e = ticket.getReporter().getEmail().trim();
            if (SIMPLE_EMAIL.matcher(e).matches()) {
                recipients.add(e);
            }
        }
        if (StringUtils.hasText(forceRecipient)) {
            String e = forceRecipient.trim();
            if (SIMPLE_EMAIL.matcher(e).matches()) {
                recipients.add(e);
            }
        }
        if (recipients.isEmpty()) {
            log.info("No valid recipient email for solved notification (ticket {})", ticket.getId());
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn(
                    "Mail sender not configured (set spring.mail.host etc.); skip solved email for ticket {} — would send to {}",
                    ticket.getId(),
                    recipients);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(recipients.toArray(String[]::new));
            message.setSubject("Smart Campus: Issue solved");
            message.setText("Your issue has been solved");
            mailSender.send(message);
            log.info("Sent solved email for ticket {} to {}", ticket.getId(), recipients);
        } catch (Exception ex) {
            log.warn("Failed to send solved email for ticket {}", ticket.getId(), ex);
        }
    }
}
