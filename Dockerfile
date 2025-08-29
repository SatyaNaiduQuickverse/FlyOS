# Dockerfile for FlyOS Frontend - COMPLETE DEBUG VERSION
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files first
COPY package.json package-lock.json* ./

# Clean install to ensure consistency
RUN npm cache clean --force
RUN rm -rf node_modules package-lock.json
RUN npm install --legacy-peer-deps

# Build stage with enhanced debugging
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy ALL source files - this is critical
COPY . .

# Enhanced debugging to understand what's being copied
RUN echo "=== COMPLETE FILE STRUCTURE DEBUG ===" && \
    echo "Root directory contents:" && \
    ls -la && \
    echo "=== APP DIRECTORY CHECK ===" && \
    if [ -d "app" ]; then \
        echo "App directory exists, contents:" && \
        find app -type f | head -20; \
    else \
        echo "❌ APP DIRECTORY NOT FOUND - This is the problem!"; \
    fi && \
    echo "=== NEXT.JS CONFIG CHECK ===" && \
    ls -la next.config.* && \
    echo "=== PACKAGE.JSON CHECK ===" && \
    cat package.json | grep -A 5 -B 5 "scripts" && \
    echo "=== TYPESCRIPT CONFIG CHECK ===" && \
    ls -la tsconfig.json && \
    echo "=== COMPONENTS CHECK ===" && \
    if [ -d "components" ]; then \
        echo "Components directory exists"; \
        find components -name "*.tsx" | head -10; \
    else \
        echo "No components directory found"; \
    fi && \
    echo "=== LIB CHECK ===" && \
    if [ -d "lib" ]; then \
        echo "Lib directory exists"; \
        find lib -name "*.ts" | head -10; \
    else \
        echo "No lib directory found"; \
    fi

# Set ALL required environment variables for build
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_DOMAIN
ARG DRONE_DB_SERVICE_URL
ARG USER_MANAGEMENT_SERVICE_URL

# Export as environment variables for the build process
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_DOMAIN=$NEXT_PUBLIC_DOMAIN
ENV DRONE_DB_SERVICE_URL=$DRONE_DB_SERVICE_URL
ENV USER_MANAGEMENT_SERVICE_URL=$USER_MANAGEMENT_SERVICE_URL

# Debug environment variables
RUN echo "=== ENVIRONMENT VARIABLES DEBUG ===" && \
    echo "NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL" && \
    echo "Build environment prepared"

# Build the application with verbose output
RUN echo "=== STARTING BUILD PROCESS ===" && \
    npm run build && \
    echo "=== BUILD COMPLETED, CHECKING OUTPUT ===" && \
    ls -la .next/ && \
    echo "=== STANDALONE OUTPUT CHECK ===" && \
    if [ -d ".next/standalone" ]; then \
        echo "Standalone build successful:" && \
        ls -la .next/standalone/ && \
        echo "=== CHECKING STANDALONE APP DIRECTORY ===" && \
        if [ -d ".next/standalone/app" ]; then \
            echo "App directory found in standalone:" && \
            find .next/standalone/app -name "*.js" | head -10; \
        else \
            echo "❌ NO APP DIRECTORY IN STANDALONE BUILD"; \
        fi; \
    else \
        echo "❌ STANDALONE BUILD FAILED"; \
        exit 1; \
    fi && \
    echo "=== STATIC FILES CHECK ===" && \
    if [ -d ".next/static" ]; then \
        echo "Static files generated:" && \
        ls -la .next/static/; \
    else \
        echo "❌ STATIC FILES MISSING"; \
    fi

# Production runtime stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create nextjs user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public directory for static assets
COPY --from=builder /app/public ./public

# Ensure video directory exists with proper permissions
RUN mkdir -p ./public/videos && \
    chown -R nextjs:nodejs ./public

# Copy the built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Final verification of what's in the runtime container
RUN echo "=== FINAL RUNTIME VERIFICATION ===" && \
    ls -la && \
    echo "=== SERVER.JS CHECK ===" && \
    if [ -f "server.js" ]; then \
        echo "✅ server.js found" && \
        head -10 server.js; \
    else \
        echo "❌ server.js missing - build failed"; \
        exit 1; \
    fi && \
    echo "=== STATIC FILES FINAL CHECK ===" && \
    ls -la .next/static/ && \
    echo "=== PUBLIC FILES CHECK ===" && \
    ls -la public/ && \
    echo "=== APP DIRECTORY IN RUNTIME ===" && \
    if [ -d "app" ]; then \
        echo "App directory found in runtime:" && \
        find app -name "*.js" | head -10; \
    else \
        echo "No app directory in runtime (normal for standalone)"; \
    fi

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set runtime environment
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
