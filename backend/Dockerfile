FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
RUN mkdir -p /app/uploads/firmware && chown -R node:node /app
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]