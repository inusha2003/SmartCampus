package com.smartcampus.hub.dto;

import com.smartcampus.hub.domain.UserRole;
import com.smartcampus.hub.entity.User;

public record UserDto(Long id, String email, String displayName, UserRole role) {
    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getDisplayName(), u.getRole());
    }
}
