# --- build: embed Vite `VITE_*` vars at compile time ---
# Image versions are pinned so Dependabot can open update PRs automatically.
FROM node:24.16.0-alpine3.23 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY src-vue ./src-vue

ARG VITE_JITSI_PUBLIC_URL
ARG VITE_XMPP_DOMAIN
ARG VITE_XMPP_MUC_DOMAIN
ARG VITE_SERVICE_URL
ARG VITE_USE_WEBSOCKET
ARG VITE_DISABLE_STUN_TURN_DISCOVERY
ARG VITE_EVENTYAY_API_BASE
ARG VITE_EVENTYAY_JWT_ENDPOINT
ARG VITE_SESSION_PREFIX
# Comma-separated origins allowed to embed LoungeMesh in an iframe.
# Baked at build time into the SPA (used in meta tag + postMessage).
ARG VITE_ALLOW_IFRAME_FROM

ENV VITE_JITSI_PUBLIC_URL=$VITE_JITSI_PUBLIC_URL \
    VITE_XMPP_DOMAIN=$VITE_XMPP_DOMAIN \
    VITE_XMPP_MUC_DOMAIN=$VITE_XMPP_MUC_DOMAIN \
    VITE_SERVICE_URL=$VITE_SERVICE_URL \
    VITE_USE_WEBSOCKET=$VITE_USE_WEBSOCKET \
    VITE_DISABLE_STUN_TURN_DISCOVERY=$VITE_DISABLE_STUN_TURN_DISCOVERY \
    VITE_EVENTYAY_API_BASE=$VITE_EVENTYAY_API_BASE \
    VITE_EVENTYAY_JWT_ENDPOINT=$VITE_EVENTYAY_JWT_ENDPOINT \
    VITE_SESSION_PREFIX=$VITE_SESSION_PREFIX \
    VITE_ALLOW_IFRAME_FROM=$VITE_ALLOW_IFRAME_FROM

RUN npm run build

# --- runtime: static SPA served by nginx ---
FROM nginx:1.31.1-alpine3.23

# The official nginx image processes *.conf.template via envsubst before start.
# NGINX_ALLOW_IFRAME_FROM sets CSP frame-ancestors at runtime without a rebuild.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html

# Default: deny all cross-origin framing.
ENV NGINX_ALLOW_IFRAME_FROM=""

EXPOSE 80
