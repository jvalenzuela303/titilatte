# =============================================================================
# Backend — Multi-stage Dockerfile
# Stage 1 (builder): Maven 3.9 + JDK 21 — compila el JAR
# Stage 2 (runtime): Eclipse Temurin JRE 21 slim — ejecuta el JAR
#
# Variables de entorno sensibles (datasource, JWT) se inyectan en runtime
# desde docker-compose vía el archivo .env — NUNCA se hardcodean aquí.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: builder
# Usa la imagen oficial de Maven con JDK 21.
# El caché de dependencias se separa de la copia del código fuente para que
# Docker reutilice la capa de dependencias cuando solo cambia el código.
# -----------------------------------------------------------------------------
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

# Copia solo el POM primero — permite cachear la descarga de dependencias.
# Esta capa solo se invalida cuando pom.xml cambia.
COPY pom.xml .
RUN mvn dependency:go-offline -q

# Copia el código fuente y compila.
# -DskipTests: los tests se ejecutan en la pipeline CI, no en la imagen.
COPY src ./src
RUN mvn package -DskipTests -q && \
    # Verifica que el JAR fue generado correctamente
    ls -lh target/*.jar

# -----------------------------------------------------------------------------
# Stage 2: runtime
# Eclipse Temurin JRE 21 Alpine — imagen mínima solo con el runtime Java.
# No incluye Maven ni el JDK completo.
# -----------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine AS runtime

# Metadatos de la imagen
LABEL org.opencontainers.image.title="Minimarket Backend" \
      org.opencontainers.image.description="Spring Boot 3 backend para Minimarket Platform" \
      org.opencontainers.image.version="1.0.0"

# Instala curl para el HEALTHCHECK interno del contenedor.
# Se limpia la caché de apk en la misma capa para no inflar la imagen.
RUN apk add --no-cache curl

# ---- Seguridad: usuario no-root ----
# Crea grupo y usuario sin privilegios. UID/GID fijos para compatibilidad
# con montajes de volúmenes en hosts Linux.
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Directorio de trabajo de la aplicación
WORKDIR /app

# Copia el JAR compilado desde el stage builder.
# El wildcard *.jar copia el JAR final (excluye *-sources.jar, etc.)
COPY --from=builder --chown=appuser:appgroup /build/target/*.jar app.jar

# Cambia al usuario no-root antes de cualquier instrucción que ejecute procesos
USER appuser

# Puerto de la aplicación Spring Boot
EXPOSE 8080

# ---- Variables de entorno para la JVM ----
# Valores por defecto — sobreescribibles en docker-compose mediante JAVA_OPTS.
# -XX:+UseG1GC: GC adecuado para aplicaciones con latencia baja.
# -XX:MaxRAMPercentage: ajusta heap dinámicamente al 75% de la RAM del contenedor.
ENV JAVA_OPTS="-Xms256m -Xmx512m \
    -XX:+UseG1GC \
    -XX:MaxGCPauseMillis=200 \
    -XX:MaxRAMPercentage=75.0 \
    -Djava.security.egd=file:/dev/./urandom \
    -Dfile.encoding=UTF-8"

# ---- Health check ----
# Spring Boot Actuator expone /actuator/health en el puerto 8080.
# start-period=60s: da tiempo al arranque de Spring + migraciones Flyway.
HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=60s \
    CMD curl -f http://localhost:8080/api/v1/actuator/health || exit 1

# Punto de entrada — sh -c permite expansión de la variable JAVA_OPTS.
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
