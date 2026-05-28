package com.minimarket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.minimarket.modules.auth.dto.LoginRequest;
import com.minimarket.modules.auth.dto.LoginResponse;
import com.minimarket.modules.users.domain.Role;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.RoleRepository;
import com.minimarket.modules.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Base class for all Phase 2 integration tests.
 *
 * <p>Provides: JWT token acquisition, test user creation, and shared fixtures.
 * Each test class extends this and optionally overrides {@code setUpModule()}
 * for module-specific data. The {@link Transactional} annotation ensures H2
 * state is rolled back between tests.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public abstract class BaseIntegrationTest {

    protected static final String AUTH_PATH = "/api/v1/auth/login";

    // ── Standard test credentials ──────────────────────────────────────────────
    protected static final String ADMIN_EMAIL      = "admin.base@test.com";
    protected static final String ADMIN_PASS       = "admin1234";
    protected static final String CAJERO_EMAIL     = "cajero.base@test.com";
    protected static final String CAJERO_PASS      = "cajero1234";
    protected static final String SUPERVISOR_EMAIL = "supervisor.base@test.com";
    protected static final String SUPERVISOR_PASS  = "super1234";
    protected static final String BODEGA_EMAIL     = "bodega.base@test.com";
    protected static final String BODEGA_PASS      = "bodega1234";

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected UserRepository userRepository;
    @Autowired protected RoleRepository roleRepository;
    @Autowired protected PasswordEncoder passwordEncoder;

    protected String adminToken;
    protected String cajeroToken;
    protected String supervisorToken;
    protected String bodegaToken;

    @BeforeEach
    void setUpBase() throws Exception {
        // ── Resolve or create roles ────────────────────────────────────────────
        Role adminRole      = findOrCreateRole(Role.RoleName.ADMIN);
        Role cajeroRole     = findOrCreateRole(Role.RoleName.CAJERO);
        Role supervisorRole = findOrCreateRole(Role.RoleName.SUPERVISOR);
        Role bodegaRole     = findOrCreateRole(Role.RoleName.BODEGA);

        // ── Resolve or create standard test users ──────────────────────────────
        createUserIfAbsent(ADMIN_EMAIL,      ADMIN_PASS,      "Admin",      "Base",  Set.of(adminRole));
        createUserIfAbsent(CAJERO_EMAIL,     CAJERO_PASS,     "Cajero",     "Base",  Set.of(cajeroRole));
        createUserIfAbsent(SUPERVISOR_EMAIL, SUPERVISOR_PASS, "Supervisor", "Base",  Set.of(supervisorRole));
        createUserIfAbsent(BODEGA_EMAIL,     BODEGA_PASS,     "Bodega",     "Base",  Set.of(bodegaRole));

        // ── Acquire JWT tokens ─────────────────────────────────────────────────
        adminToken      = getAuthToken(ADMIN_EMAIL,      ADMIN_PASS);
        cajeroToken     = getAuthToken(CAJERO_EMAIL,     CAJERO_PASS);
        supervisorToken = getAuthToken(SUPERVISOR_EMAIL, SUPERVISOR_PASS);
        bodegaToken     = getAuthToken(BODEGA_EMAIL,     BODEGA_PASS);

        // Hook for subclasses to set up module-specific data
        setUpModule();
    }

    /**
     * Override in subclasses to seed module-specific fixtures after base
     * users and tokens have been initialised.
     */
    protected void setUpModule() throws Exception {
        // no-op by default
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Performs a POST /auth/login and returns the access token.
     */
    protected String getAuthToken(String email, String password) throws Exception {
        LoginRequest req = new LoginRequest(email, password);
        MvcResult result = mockMvc.perform(post(AUTH_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readValue(
                result.getResponse().getContentAsString(), LoginResponse.class
        ).accessToken();
    }

    /**
     * Creates a user with the given role set only if the email is not yet
     * present in the repository. Safe to call in transactions that will roll
     * back, because the check guards against duplicate-key errors.
     */
    protected User createUserIfAbsent(String email, String rawPassword,
                                      String firstName, String lastName,
                                      Set<Role> roles) {
        return userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseGet(() -> userRepository.save(
                        User.builder()
                                .email(email)
                                .passwordHash(passwordEncoder.encode(rawPassword))
                                .firstName(firstName)
                                .lastName(lastName)
                                .active(true)
                                .roles(roles)
                                .build()
                ));
    }

    /**
     * Finds an existing role by name or creates it if absent.
     */
    protected Role findOrCreateRole(Role.RoleName name) {
        return roleRepository.findByName(name)
                .orElseGet(() -> roleRepository.save(
                        Role.builder().name(name).build()
                ));
    }
}
