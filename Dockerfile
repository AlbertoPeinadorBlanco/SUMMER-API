FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the rest of the source code
COPY . .

EXPOSE 3000

# Optional: Ensure nodemon isn't run in production, use standard node.
CMD ["npm", "start"]
