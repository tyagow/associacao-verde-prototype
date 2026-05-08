FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4174
ENV DB_FILE=/data/associacao-verde.sqlite
ENV DOCUMENT_STORAGE_DIR=/data/private-documents

COPY package.json package-lock.json ./
RUN npm ci

COPY app ./app
COPY public ./public
COPY src ./src
COPY server.mjs ./

RUN npm run next:build && npm prune --omit=dev && mkdir -p /data/private-documents

EXPOSE 4174

CMD ["node", "server.mjs"]
