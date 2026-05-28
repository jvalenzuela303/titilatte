# =============================================================================
# Frontend — Multi-stage Dockerfile
# Stage 1 (development): Node 20 Alpine — servidor de desarrollo Vite (HMR)
# Stage 2 (builder):     Node 20 Alpine — compila el build estático de producción
# Stage 3 (runtime):     Nginx Alpine   — sirve los archivos estáticos
#
# El stage "development" es referenciado exclusivamente por docker-compose.override.yml.
# El stage "runtime" es el target por defecto en producción.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: development (solo para docker-compose.override.yml)
# Servidor de desarrollo Vite con Hot Module Replacement.
# No se usa en producción.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS development

WORKDIR /app

# Instala dependencias primero (capa cacheada por Docker mientras package.json no cambie)
COPY package.json package-lock.json* ./
RUN npm install --prefer-offline

# El código fuente se monta como volumen en el override — no se copia aquí.
# Solo se copia package.json para la instalación de deps.

# Puerto del dev server de Vite
EXPOSE 5173

# HMR requiere que Vite escuche en 0.0.0.0 dentro del contenedor
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# -----------------------------------------------------------------------------
# Stage 2: builder
# Instala todas las dependencias y construye el bundle estático.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copia manifiestos de dependencias primero para aprovechar el caché de capas.
COPY package.json package-lock.json* ./
RUN npm install --prefer-offline

# Copia el resto del código fuente
COPY . .

# Variables de build inyectadas en tiempo de compilación (no en runtime).
# VITE_API_URL puede sobreescribirse con --build-arg en CI/CD.
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build && \
    # Verifica que el directorio dist fue generado
    ls -lh dist/

# -----------------------------------------------------------------------------
# Stage 3: runtime
# Nginx Alpine sirve los archivos estáticos del build.
# Configuración mínima de Nginx para SPA (React Router).
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="Minimarket Frontend" \
      org.opencontainers.image.description="React 18 SPA para Minimarket Platform" \
      org.opencontainers.image.version="1.0.0"

# ---- Seguridad: usuario no-root ----
# La imagen oficial de nginx:alpine ya incluye el usuario 'nginx' (UID 101).
# Reasignamos la propiedad de los directorios necesarios para que nginx
# pueda escribir logs y pid sin ser root.
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    # Nginx necesita escribir su PID en /var/run — lo movemos a /tmp
    sed -i 's|/var/run/nginx.pid|/tmp/nginx.pid|g' /etc/nginx/nginx.conf && \
    # Asegura que el directorio de archivos estáticos es accesible
    touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

# Configuración de Nginx para SPA — todos los paths a index.html
# Este nginx.conf es del CONTENEDOR DEL FRONTEND (puerto 80 interno).
# Es diferente al nginx.conf del reverse proxy en infra/nginx/.
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Health check endpoint para Docker\n\
    location /health {\n\
        access_log off;\n\
        return 200 "ok";\n\
        add_header Content-Type text/plain;\n\
    }\n\
\n\
    # React Router — todos los paths que no son archivos reales → index.html\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    # Assets con caché agresiva (Vite genera hashes en los nombres)\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

# Copia los archivos estáticos desde el stage builder
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Cambia al usuario no-root
USER nginx

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
    CMD wget -qO- http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
