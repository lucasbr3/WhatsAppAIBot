FROM node:20-slim AS build

WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq python3 make g++ ffmpeg && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

RUN mkdir -p frontend
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci
WORKDIR /app

FROM node:20-slim AS frontend-builder

WORKDIR /app

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

FROM node:20-slim

WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq ffmpeg && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=frontend-builder /app/frontend/src/dashboard ./src/dashboard
COPY package*.json ./
COPY src/ ./src/

RUN mkdir -p data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
