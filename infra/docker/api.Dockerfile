FROM node:24-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json

RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build --workspace @dashboard/contracts \
  && npm run build --workspace @dashboard/api

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY package.json package-lock.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json

RUN npm ci --omit=dev --workspace @dashboard/api --workspace @dashboard/contracts \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 dashboard

COPY --from=builder --chown=dashboard:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=dashboard:nodejs /app/packages/contracts/dist ./packages/contracts/dist

USER dashboard
EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
