# Use the Red Hat UBI Node.js image
FROM registry.access.redhat.com/ubi9/nodejs-20:latest

# Set the working directory
WORKDIR /opt/app-root/src

# Set permissions for the working directory so the build user can write to it
USER 0
RUN chown -R 1001:0 /opt/app-root/src && \
    chmod -R g+rwX /opt/app-root/src
USER 1001

# Copy package files and install dependencies
# We copy only these first to leverage Docker layer caching
COPY package*.json ./
RUN npm install

# Copy the rest of the application source
COPY . .

# Build the project
RUN npm run build

# Expose the port your app runs on
EXPOSE 8080

# Start the application
CMD ["node", "dist/server.cjs"]