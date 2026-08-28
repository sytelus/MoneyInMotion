FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/web/package.json packages/web/package.json

RUN npm ci

COPY . .

RUN npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV MIM_DATA_ROOT=/data
ENV MIM_USERNAME=moneyinmotion
ENV MIM_PORT=3001

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/core/package.json ./packages/core/package.json
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/web/dist ./packages/web/dist

RUN mkdir -p /data && chown node:node /data

VOLUME ["/data"]

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch(`http://127.0.0.1:${process.env.MIM_PORT || 3001}/api/health`).then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

USER node

CMD ["node", "packages/server/dist/index.js"]
