package com.smartcampus.hub.service;

import com.smartcampus.hub.config.AppProperties;
import com.smartcampus.hub.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FileStorageService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif");

    private final AppProperties appProperties;

    public String storeTicketAttachment(Long ticketId, MultipartFile file) {
        if (file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_EMPTY", "Empty file");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TYPE",
                    "Only JPEG, PNG, WebP, GIF images allowed");
        }
        String original = file.getOriginalFilename();
        String safeExt = "";
        if (original != null && original.contains(".")) {
            safeExt = original.substring(original.lastIndexOf('.')).toLowerCase();
            if (safeExt.length() > 8) {
                safeExt = "";
            }
        }
        String storedName = UUID.randomUUID() + safeExt;
        Path dir = Path.of(appProperties.getUploadDir(), "tickets", String.valueOf(ticketId));
        try {
            Files.createDirectories(dir);
            Path target = dir.resolve(storedName);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return target.toString().replace("\\", "/");
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORE_FAILED", "Could not store file");
        }
    }

    public Path resolveStoredPath(String storedPath) {
        return Path.of(storedPath);
    }
}
