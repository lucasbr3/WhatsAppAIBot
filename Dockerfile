# Stage 1: Backend dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Frontend build
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Stage 3: Runtime image
FROM node:20-slim
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq ffmpeg && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=frontend-builder /app/src/dashboard ./src/dashboard
COPY package*.json ./
COPY src/ ./src/
RUN mkdir -p data
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
