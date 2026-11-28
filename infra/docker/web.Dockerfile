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

ARG INTERNAL_API_URL
ARG NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ENV NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=$NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build --workspace @dashboard/contracts \
  && npm run build --workspace @dashboard/web

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
