# Stage 1: Build the application
FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS builder

WORKDIR /opt/app-root/src

# Copy dependency manifests
COPY package*.json ./

# RUN chown -R 1001:0 /opt/app-root/src  <-- DELETE THIS LINE
# RUN USER 1001                        <-- DELETE THIS LINE

# The base image already sets up the environment correctly for OpenShift
RUN npm install

# Copy the rest of the application source code
COPY . .

# Run the build
RUN npm run build