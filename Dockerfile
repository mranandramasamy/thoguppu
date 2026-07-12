# Stage 1: Build the application
FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS builder

# Use Red Hat's standard user home directory which has pre-configured permissions
WORKDIR /opt/app-root/src

# Copy dependency manifests
COPY package*.json ./

# Install ALL dependencies (including devDependencies like typescript, vite, esbuild)
RUN npm install

# Copy the rest of the application source code
COPY . .

# Run the build command (creates dist/ containing server.cjs and static assets)
RUN npm run build

# Stage 2: Clean production runner
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal:latest AS runner

WORKDIR /opt/app-root/src

# Copy package.json to run startup scripts
COPY package.json ./

# Install production-only dependencies
RUN npm install --omit=dev

# Copy only the compiled build output from the builder stage
COPY --from=builder /opt/app-root/src/dist ./dist

# Create database folder and configure permissions for OpenShift (Root Group 0 compatibility)
RUN mkdir -p cms_data && \
    chgrp -R 0 cms_data && \
    chmod -R g+w cms_data

# OpenShift dynamic user guidelines (runs as user 1001 by default)
USER 1001

# Knative dynamically assigns the PORT env (default: 8080).
EXPOSE 8080

ENV NODE_ENV=production

CMD ["npm", "run", "start"]