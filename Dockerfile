FROM node:22-alpine AS client-build
WORKDIR /app

COPY client/package*.json ./
RUN npm ci
COPY client .
RUN npm run build

FROM node:22-alpine AS server-build
WORKDIR /app

COPY server/package*.json ./
RUN npm ci
COPY server .
RUN npx tsc

FROM node:22-alpine
WORKDIR /app
COPY --from=server-build /app/dist ./dist
COPY --from=server-build /app/node_modules ./node_modules
COPY --from=client-build /app/dist ./static

EXPOSE 9999
CMD ["node", "dist/index.js"]
