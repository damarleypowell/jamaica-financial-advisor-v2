FROM node:20-slim AS frontend-build
WORKDIR /build
COPY frontend/ ./
# Vite bakes VITE_* vars at build time. frontend/.env is gitignored, so set the
# (public) Google OAuth client ID here so the "Continue with Google" button is
# present in the production build. Overridable via a Docker build arg.
ARG VITE_GOOGLE_CLIENT_ID=841732497292-s4uoh9t16j0ee4s8vn6653d7kf9ni7ie.apps.googleusercontent.com
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm install && npm run build

FROM node:20-slim AS production
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
COPY --from=frontend-build /build/dist ./public-react

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
