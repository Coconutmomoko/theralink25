# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container to the root of the app
WORKDIR /app

# Copy the entire project to the container
COPY . .

# Set the working directory to the 'backend' folder
WORKDIR /app/backend

# Install backend dependencies
RUN npm install

# Expose the backend port (5000)
EXPOSE 5000

# Start the backend server
CMD ["node", "server.js"]
