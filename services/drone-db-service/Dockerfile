FROM node:18-alpine

WORKDIR /app

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

# Run service
CMD ["node", "dist/app.js"]
