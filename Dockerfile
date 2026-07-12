FROM registry.access.redhat.com/ubi9/nodejs-20:latest

WORKDIR /opt/app-root/src

# 1. Copy only the dependency files
COPY package*.json ./

# 2. THE FIX: Remove the lockfile. 
# This ensures npm generates a fresh one owned by the container user,
# avoiding the 'permission denied' error on the file copied from your host.
RUN rm -f package-lock.json

# 3. Now install. npm will create a new, compatible lockfile automatically.
RUN npm install

# 4. Copy the rest of the application
COPY . .

# 5. Build
RUN npm run build

# 6. Run
CMD ["node", "dist/server.cjs"]