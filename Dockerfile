# Use the official Node.js runtime as base image
FROM node:20-slim

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["npx", "ts-node", "src/server.ts"]