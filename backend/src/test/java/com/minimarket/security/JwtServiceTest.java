package com.minimarket.security;

import com.minimarket.config.JwtConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtService - Unit Tests")
class JwtServiceTest {

    private JwtService jwtService;

    @Mock
    private JwtConfig jwtConfig;

    // 256-bit key para HMAC-SHA256
    private static final String TEST_SECRET = "testSecretKeyForTestingPurposesOnly256BitsLong!!";
    private static final long   EXPIRATION_15_MIN = 900_000L;
    private static final long   EXPIRATION_EXPIRED = -1_000L; // ya expirado

    private UserDetails userDetails;

    @BeforeEach
    void setUp() {
        when(jwtConfig.getSecret()).thenReturn(TEST_SECRET);
        when(jwtConfig.getExpiration()).thenReturn(EXPIRATION_15_MIN);

        jwtService = new JwtService(jwtConfig);

        userDetails = new User(
                "cajero@minimarket.com",
                "hashedPassword",
                List.of(new SimpleGrantedAuthority("ROLE_CAJERO"))
        );
    }

    // ─── generateAccessToken ──────────────────────────────────────────────────

    @Nested
    @DisplayName("generateAccessToken()")
    class GenerateAccessToken {

        @Test
        @DisplayName("generateToken_ShouldContainUserEmail")
        void generateToken_ShouldContainUserEmail() {
            // Act
            String token = jwtService.generateAccessToken(userDetails);

            // Assert
            assertThat(token).isNotBlank();
            String extractedEmail = jwtService.extractUsername(token);
            assertThat(extractedEmail).isEqualTo("cajero@minimarket.com");
        }

        @Test
        @DisplayName("generateToken_ShouldProduceDifferentTokensForDifferentUsers")
        void generateToken_ShouldProduceDifferentTokensForDifferentUsers() {
            // Arrange
            UserDetails adminUser = new User(
                    "admin@minimarket.com",
                    "hashedPassword",
                    List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
            );

            // Act
            String tokenCajero = jwtService.generateAccessToken(userDetails);
            String tokenAdmin  = jwtService.generateAccessToken(adminUser);

            // Assert
            assertThat(tokenCajero).isNotEqualTo(tokenAdmin);
            assertThat(jwtService.extractUsername(tokenCajero)).isEqualTo("cajero@minimarket.com");
            assertThat(jwtService.extractUsername(tokenAdmin)).isEqualTo("admin@minimarket.com");
        }

        @Test
        @DisplayName("generateToken_ShouldHaveExpiration")
        void generateToken_ShouldHaveExpiration() {
            // Act
            String token = jwtService.generateAccessToken(userDetails);

            // Assert
            assertThat(jwtService.extractExpiration(token)).isNotNull();
            assertThat(jwtService.extractExpiration(token)).isInTheFuture();
        }
    }

    // ─── generateRefreshToken ─────────────────────────────────────────────────

    @Nested
    @DisplayName("generateRefreshToken()")
    class GenerateRefreshToken {

        @Test
        @DisplayName("generateRefreshToken_ShouldReturnNonBlankUUID")
        void generateRefreshToken_ShouldReturnNonBlankUUID() {
            // Act
            String token1 = jwtService.generateRefreshToken();
            String token2 = jwtService.generateRefreshToken();

            // Assert
            assertThat(token1).isNotBlank();
            assertThat(token2).isNotBlank();
            // Cada llamada genera un token único
            assertThat(token1).isNotEqualTo(token2);
        }
    }

    // ─── isTokenValid ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("isTokenValid()")
    class IsTokenValid {

        @Test
        @DisplayName("validateToken_WhenValid_ShouldReturnTrue")
        void validateToken_WhenValid_ShouldReturnTrue() {
            // Arrange
            String token = jwtService.generateAccessToken(userDetails);

            // Act
            boolean valid = jwtService.isTokenValid(token, userDetails);

            // Assert
            assertThat(valid).isTrue();
        }

        @Test
        @DisplayName("validateToken_WhenExpired_ShouldReturnFalse")
        void validateToken_WhenExpired_ShouldReturnFalse() {
            // Arrange — generamos token con expiración negativa (ya expirado)
            when(jwtConfig.getExpiration()).thenReturn(EXPIRATION_EXPIRED);
            JwtService expiredService = new JwtService(jwtConfig);

            String expiredToken = expiredService.generateAccessToken(userDetails);

            // Restauramos configuración original para la validación
            when(jwtConfig.getExpiration()).thenReturn(EXPIRATION_15_MIN);
            JwtService validatingService = new JwtService(jwtConfig);

            // Act
            boolean valid = validatingService.isTokenValid(expiredToken, userDetails);

            // Assert
            assertThat(valid).isFalse();
        }

        @Test
        @DisplayName("validateToken_WhenTampered_ShouldReturnFalse")
        void validateToken_WhenTampered_ShouldReturnFalse() {
            // Arrange
            String token = jwtService.generateAccessToken(userDetails);
            // Modificamos la firma cambiando el último caracter
            String tamperedToken = token.substring(0, token.length() - 4) + "XXXX";

            // Act
            boolean valid = jwtService.isTokenValid(tamperedToken, userDetails);

            // Assert
            assertThat(valid).isFalse();
        }

        @Test
        @DisplayName("validateToken_WhenUsernameMismatch_ShouldReturnFalse")
        void validateToken_WhenUsernameMismatch_ShouldReturnFalse() {
            // Arrange — token generado para cajero, validado contra admin
            String token = jwtService.generateAccessToken(userDetails);
            UserDetails differentUser = new User(
                    "otro@minimarket.com",
                    "hashedPassword",
                    List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
            );

            // Act
            boolean valid = jwtService.isTokenValid(token, differentUser);

            // Assert
            assertThat(valid).isFalse();
        }

        @Test
        @DisplayName("validateToken_WhenTokenIsGarbage_ShouldReturnFalse")
        void validateToken_WhenTokenIsGarbage_ShouldReturnFalse() {
            // Act
            boolean valid = jwtService.isTokenValid("esto.no.es.un.jwt", userDetails);

            // Assert
            assertThat(valid).isFalse();
        }
    }

    // ─── extractUsername ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("extractUsername()")
    class ExtractUsername {

        @Test
        @DisplayName("extractUsername_ShouldReturnSubjectClaim")
        void extractUsername_ShouldReturnSubjectClaim() {
            // Arrange
            String token = jwtService.generateAccessToken(userDetails);

            // Act
            String username = jwtService.extractUsername(token);

            // Assert
            assertThat(username).isEqualTo("cajero@minimarket.com");
        }

        @Test
        @DisplayName("extractUsername_WhenTokenIsInvalid_ShouldThrowException")
        void extractUsername_WhenTokenIsInvalid_ShouldThrowException() {
            // Act & Assert
            assertThatThrownBy(() -> jwtService.extractUsername("invalid.token.value"))
                    .isInstanceOf(Exception.class);
        }
    }
}
