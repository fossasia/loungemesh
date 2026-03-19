# --- build: embed Vite `VITE_*` vars at compile time ---
FROM node:20-alpine AS build

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
ARG VITE_EVENTYAY_API_BASE
ARG VITE_SESSION_PREFIX

ENV VITE_JITSI_PUBLIC_URL=$VITE_JITSI_PUBLIC_URL \
    VITE_XMPP_DOMAIN=$VITE_XMPP_DOMAIN \
    VITE_XMPP_MUC_DOMAIN=$VITE_XMPP_MUC_DOMAIN \
    VITE_SERVICE_URL=$VITE_SERVICE_URL \
    VITE_USE_WEBSOCKET=$VITE_USE_WEBSOCKET \
    VITE_EVENTYAY_API_BASE=$VITE_EVENTYAY_API_BASE \
    VITE_SESSION_PREFIX=$VITE_SESSION_PREFIX

RUN npm run build

# --- runtime: static SPA ---
FROM nginx:stable-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
