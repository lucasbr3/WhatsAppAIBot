FROM node:20-slim AS build

WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq python3 make g++ ffmpeg && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

FROM node:20-slim

WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq ffmpeg && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY . .

RUN mkdir -p data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
