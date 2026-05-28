package com.minimarket.sse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.UUID;

import com.minimarket.modules.users.repository.UserRepository;

@RestController
@RequestMapping("/events")
@RequiredArgsConstructor
@Slf4j
public class SseController {

    private final SseEmitterRegistry registry;
    private final UserRepository userRepository;

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(Authentication authentication) {
        UUID userId = resolveUserId(authentication);
        SseEmitter emitter = new SseEmitter(300_000L); // 5 min timeout
        registry.register(userId, emitter);

        try {
            emitter.send(SseEmitter.event().name("CONNECTED").data("connected"));
        } catch (IOException e) {
            log.warn("Failed to send initial SSE connection event to userId={}", userId);
            registry.remove(userId);
        }

        log.info("SSE client connected: userId={}", userId);
        return emitter;
    }

    private UUID resolveUserId(Authentication authentication) {
        String email = ((UserDetails) authentication.getPrincipal()).getUsername();
        return userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + email))
                .getId();
    }
}
