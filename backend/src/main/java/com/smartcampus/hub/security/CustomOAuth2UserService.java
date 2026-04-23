package com.smartcampus.hub.security;

import com.smartcampus.hub.domain.UserRole;
import com.smartcampus.hub.entity.User;
import com.smartcampus.hub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oauthUser = super.loadUser(userRequest);
        String provider = userRequest.getClientRegistration().getRegistrationId();
        String subject = oauthUser.getName();
        String email = oauthUser.getAttribute("email");
        if (email == null || email.isBlank()) {
            throw new OAuth2AuthenticationException(new OAuth2Error("invalid_user"), "Email scope required");
        }
        String displayNameAttr = oauthUser.getAttribute("name");
        String displayName = (displayNameAttr == null || displayNameAttr.isBlank()) ? email : displayNameAttr;

        User user = userRepository.findByOauthProviderAndOauthSubject(provider, subject)
                .map(u -> {
                    u.setDisplayName(displayName);
                    return userRepository.save(u);
                })
                .orElseGet(() -> userRepository.findByEmail(email)
                        .map(u -> {
                            u.setOauthProvider(provider);
                            u.setOauthSubject(subject);
                            u.setDisplayName(displayName);
                            return userRepository.save(u);
                        })
                        .orElseGet(() -> userRepository.save(User.builder()
                                .email(email)
                                .displayName(displayName)
                                .role(UserRole.USER)
                                .oauthProvider(provider)
                                .oauthSubject(subject)
                                .build())));
        return new AppUserPrincipal(user, oauthUser.getAttributes());
    }
}
