package com.minimarket.sse;

import com.minimarket.BaseIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for SseController — verifies authentication guard and
 * stream content-type. Does not assert on SSE frame content because MockMvc
 * does not run the async response in the same thread; we only need to confirm
 * the correct HTTP response is returned before the first async write.
 */
@DisplayName("SseController - Integration Tests")
class SseControllerIntegrationTest extends BaseIntegrationTest {

    private static final String STREAM_PATH = "/api/v1/events/stream";

    // ── Authentication guard ───────────────────────────────────────────────────

    @Test
    @DisplayName("GET /events/stream sin auth → 401")
    void subscribeWithoutToken_ShouldReturn401() throws Exception {
        mockMvc.perform(get(STREAM_PATH)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized());
    }

    // ── Authenticated access ───────────────────────────────────────────────────

    @Test
    @DisplayName("GET /events/stream con JWT válido (ADMIN) → 200, Content-Type: text/event-stream")
    void subscribeWithAdminToken_ShouldReturn200WithEventStreamContentType() throws Exception {
        mockMvc.perform(get(STREAM_PATH)
                        .header("Authorization", "Bearer " + adminToken)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM));
    }

    @Test
    @DisplayName("GET /events/stream con JWT válido (CAJERO) → 200")
    void subscribeWithCajeroToken_ShouldReturn200() throws Exception {
        mockMvc.perform(get(STREAM_PATH)
                        .header("Authorization", "Bearer " + cajeroToken)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM));
    }

    @Test
    @DisplayName("GET /events/stream con JWT válido (SUPERVISOR) → 200")
    void subscribeWithSupervisorToken_ShouldReturn200() throws Exception {
        mockMvc.perform(get(STREAM_PATH)
                        .header("Authorization", "Bearer " + supervisorToken)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM));
    }

    @Test
    @DisplayName("GET /events/stream con token inválido → 401")
    void subscribeWithInvalidToken_ShouldReturn401() throws Exception {
        mockMvc.perform(get(STREAM_PATH)
                        .header("Authorization", "Bearer invalid.token.here")
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized());
    }
}
