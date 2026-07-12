# Stage 1: Build the application
FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS builder

WORKDIR /opt/app-root/src

# Copy dependency manifests
COPY package*.json ./

# CHANGE: Change ownership of the copied files to the user that runs the build
# This ensures npm has permission to write package-lock.json
RUN chown -R 1001:0 /opt/app-root/src

# Switch to the user to perform the install
USER 1001

# Install ALL dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Run the build
RUN npm run build