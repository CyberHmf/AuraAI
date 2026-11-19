# Base Node image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=9876

# Copy dependency manifests
COPY package*.json ./

# Install dependencies reproducibly
RUN npm ci

# Copy application source code
COPY . .

# Build production bundle
RUN npm run build

# Expose web server port
EXPOSE 9876

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:${PORT:-9876}/ || exit 1

# Start the full-stack server
CMD ["npm", "start"]
