# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container to the root of the app
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY backend/package*.json ./backend/

# Set the working directory to the 'backend' folder
WORKDIR /app/backend

# Install backend dependencies
RUN npm install

# Copy the rest of the project files to the container
COPY . .

# Expose the backend port (5000)
EXPOSE 5000

# Start the backend server
CMD ["node", "server.js"]