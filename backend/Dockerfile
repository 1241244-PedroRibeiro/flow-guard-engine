# Multi-stage build for optimized production footprint (FlowGuard Telemetry Engine)

# Stage 1: Build & Compilation
FROM node:20-alpine AS builder

WORKDIR /app

# Install native toolchain required for compiling native binary modules (e.g. argon2)
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package*.json ./

# Install all dependencies including devDependencies for TypeScript compilation
RUN npm ci

# Copy all source files and tsconfig
COPY . .

# Compile TypeScript to JavaScript in dist/
RUN npm run build

# ----------------------------------------------------
# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package manifests
COPY package*.json ./

# Install only production dependencies and remove compiler toolchain afterwards
RUN apk add --no-cache python3 make g++ && \
    npm ci --only=production && \
    apk del python3 make g++

# Copy compiled dist folder from builder stage
COPY --from=builder /app/dist ./dist

# Expose internal application port
EXPOSE 3000

# Start command
CMD ["node", "dist/index.js"]