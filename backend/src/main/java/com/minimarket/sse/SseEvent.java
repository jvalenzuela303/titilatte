package com.minimarket.sse;

import java.time.LocalDateTime;

public record SseEvent(
        SseEventType eventType,
        Object data,
        LocalDateTime timestamp
) {}
