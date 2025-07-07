FROM node:18-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache \
    make \
    g++ \
    python3 \
    py3-pip \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    giflib-dev \
    && ln -sf python3 /usr/bin/python

# Install TypeScript globally
RUN npm install -g typescript

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 4005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4005/health || exit 1

# Start service
CMD ["npm", "start"]