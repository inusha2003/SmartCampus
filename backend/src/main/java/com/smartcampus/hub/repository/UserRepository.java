package com.smartcampus.hub.repository;

import com.smartcampus.hub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import com.smartcampus.hub.domain.UserRole;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    Optional<User> findByOauthProviderAndOauthSubject(String provider, String subject);

    List<User> findByRoleIn(Collection<UserRole> roles);
}
