package com.minimarket.modules.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.minimarket.modules.auth.dto.LoginRequest;
import com.minimarket.modules.auth.dto.LoginResponse;
import com.minimarket.modules.auth.dto.RefreshTokenRequest;
import com.minimarket.modules.users.domain.Role;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.RoleRepository;
import com.minimarket.modules.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("AuthController - Integration Tests")
class AuthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final String BASE_PATH   = "/api/v1/auth";
    private static final String ADMIN_EMAIL = "admin@test.com";
    private static final String ADMIN_PASS  = "admin1234";

    @BeforeEach
    void setUp() {
        // Ensure ADMIN role exists
        Role adminRole = roleRepository.findByName(Role.RoleName.ADMIN)
                .orElseGet(() -> roleRepository.save(
                        Role.builder().name(Role.RoleName.ADMIN).build()
                ));

        // Create test admin user if not present
        if (!userRepository.existsByEmailAndDeletedAtIsNull(ADMIN_EMAIL)) {
            User admin = User.builder()
                    .email(ADMIN_EMAIL)
                    .passwordHash(passwordEncoder.encode(ADMIN_PASS))
                    .firstName("Admin")
                    .lastName("Test")
                    .active(true)
                    .roles(Set.of(adminRole))
                    .build();
            userRepository.save(admin);
        }
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private LoginResponse performLogin(String email, String password) throws Exception {
        LoginRequest request = new LoginRequest(email, password);
        MvcResult result = mockMvc.perform(post(BASE_PATH + "/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readValue(result.getResponse().getContentAsString(), LoginResponse.class);
    }

    // ─── POST /auth/login ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("POST /auth/login")
    class Login {

        @Test
        @DisplayName("should return 200 with tokens when credentials are valid")
        void login_WhenValidCredentials_ShouldReturn200WithTokens() throws Exception {
            // Arrange
            LoginRequest request = new LoginRequest(ADMIN_EMAIL, ADMIN_PASS);

            // Act & Assert
            MvcResult result = mockMvc.perform(post(BASE_PATH + "/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                    .andExpect(jsonPath("$.tokenType").value("Bearer"))
                    .andExpect(jsonPath("$.email").value(ADMIN_EMAIL))
                    .andReturn();

            LoginResponse response = objectMapper.readValue(
                    result.getResponse().getContentAsString(), LoginResponse.class);
            assertThat(response.accessToken()).isNotBlank();
            assertThat(response.refreshToken()).isNotBlank();
        }

        @Test
        @DisplayName("should return 401 when password is incorrect")
        void login_WhenPasswordIncorrect_ShouldReturn401() throws Exception {
            // Arrange
            LoginRequest request = new LoginRequest(ADMIN_EMAIL, "wrongPassword");

            // Act & Assert
            mockMvc.perform(post(BASE_PATH + "/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("should return 401 when user does not exist")
        void login_WhenUserNotFound_ShouldReturn401() throws Exception {
            // Arrange
            LoginRequest request = new LoginRequest("noexiste@test.com", "cualquier");

            // Act & Assert
            mockMvc.perform(post(BASE_PATH + "/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("should return 400 when email format is invalid")
        void login_WhenInvalidEmailFormat_ShouldReturn400() throws Exception {
            // Arrange
            LoginRequest request = new LoginRequest("not-an-email", ADMIN_PASS);

            // Act & Assert
            mockMvc.perform(post(BASE_PATH + "/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("should return 400 when password is blank")
        void login_WhenPasswordIsBlank_ShouldReturn400() throws Exception {
            // Arrange
            LoginRequest request = new LoginRequest(ADMIN_EMAIL, "");

            // Act & Assert
            mockMvc.perform(post(BASE_PATH + "/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }
    }

    // ─── POST /auth/refresh ───────────────────────────────────────────────────

    @Nested
    @DisplayName("POST /auth/refresh")
    class Refresh {

        @Test
        @DisplayName("should return 200 with new accessToken when refresh token is valid")
        void refresh_WhenValidRefreshToken_ShouldReturn200WithNewAccessToken() throws Exception {
            // Arrange — first login to get a valid refresh token
            LoginResponse loginResponse = performLogin(ADMIN_EMAIL, ADMIN_PASS);
            RefreshTokenRequest request = new RefreshTokenRequest(loginResponse.refreshToken());

            // Act & Assert
            mockMvc.perform(post(BASE_PATH + "/refresh")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.email").value(ADMIN_EMAIL));
        }

        @Test
        @DisplayName("should return 422 when refresh token is invalid/unknown")
        void refresh_WhenInvalidRefreshToken_ShouldReturn422() throws Exception {
            // Arrange
            RefreshTokenRequest request = new RefreshTokenRequest("00000000-0000-0000-0000-000000000000");

            // Act & Assert
            mockMvc.perform(post(BASE_PATH + "/refresh")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnprocessableEntity());
        }

        @Test
        @DisplayName("should return 422 when refresh token has been revoked by logout")
        void refresh_WhenRefreshTokenRevokedByLogout_ShouldReturn422() throws Exception {
            // Arrange — login, then logout (revoke), then try to refresh
            LoginResponse loginResponse = performLogin(ADMIN_EMAIL, ADMIN_PASS);
            RefreshTokenRequest revokeRequest = new RefreshTokenRequest(loginResponse.refreshToken());

            // Logout revokes the refresh token
            mockMvc.perform(post(BASE_PATH + "/logout")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(revokeRequest)))
                    .andExpect(status().isNoContent());

            // Try refresh with revoked token
            mockMvc.perform(post(BASE_PATH + "/refresh")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(revokeRequest)))
                    .andExpect(status().isUnprocessableEntity());
        }
    }

    // ─── POST /auth/logout ────────────────────────────────────────────────────

    @Nested
    @DisplayName("POST /auth/logout")
    class Logout {

        @Test
        @DisplayName("should return 204 and revoke the refresh token")
        void logout_WhenValidRefreshToken_ShouldReturn204AndRevokeToken() throws Exception {
            // Arrange
            LoginResponse loginResponse = performLogin(ADMIN_EMAIL, ADMIN_PASS);
            RefreshTokenRequest request = new RefreshTokenRequest(loginResponse.refreshToken());

            // Act — logout
            mockMvc.perform(post(BASE_PATH + "/logout")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNoContent());

            // Assert — subsequent refresh with the same token must fail
            mockMvc.perform(post(BASE_PATH + "/refresh")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnprocessableEntity());
        }

        @Test
        @DisplayName("should return 422 when attempting to logout with an already revoked token")
        void logout_WhenTokenAlreadyRevoked_ShouldReturn422() throws Exception {
            // Arrange — first logout revokes the token
            LoginResponse loginResponse = performLogin(ADMIN_EMAIL, ADMIN_PASS);
            RefreshTokenRequest request = new RefreshTokenRequest(loginResponse.refreshToken());

            mockMvc.perform(post(BASE_PATH + "/logout")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNoContent());

            // Act & Assert — second logout with same (revoked) token
            mockMvc.perform(post(BASE_PATH + "/logout")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnprocessableEntity());
        }
    }
}
