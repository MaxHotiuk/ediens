# ==============================================================================
# ēdiens Multi-Stage Production Dockerfile
# Targets:
#   - 'api': ASP.NET Core 8.0 Web API runtime (port 8080)
#   - 'web': Nginx Alpine serving React SPA (port 80)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: .NET API Build
# ------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS api-build
WORKDIR /src

# Copy project file to optimize layer caching
COPY src/Ediens.Api/Ediens.Api.csproj src/Ediens.Api/
RUN dotnet restore src/Ediens.Api/Ediens.Api.csproj

# Copy remaining source code and publish release build
COPY src/Ediens.Api/ src/Ediens.Api/
WORKDIR /src/src/Ediens.Api
RUN dotnet publish -c Release -o /app/publish --no-restore

# ------------------------------------------------------------------------------
# Stage 2: .NET API Runtime
# ------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS api
WORKDIR /app
EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production

# Install curl for container healthcheck
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

USER $APP_UID
COPY --from=api-build /app/publish .

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "Ediens.Api.dll"]

# ------------------------------------------------------------------------------
# Stage 3: React Web Frontend Build
# ------------------------------------------------------------------------------
FROM node:22-alpine AS web-build
WORKDIR /app

# Install dependencies using package-lock.json
COPY src/ediens-web/package*.json ./
RUN npm ci

# Copy source and build production bundle
COPY src/ediens-web/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 4: React Web Frontend Runtime (Nginx Alpine)
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS web
WORKDIR /usr/share/nginx/html

# Clean default assets
RUN rm -rf ./*

# Copy compiled frontend from build stage
COPY --from=web-build /app/dist .

# Copy production Nginx reverse proxy configuration
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
