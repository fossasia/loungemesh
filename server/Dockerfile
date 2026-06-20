FROM node:22.13.1-alpine3.21 AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
RUN npx prisma generate
RUN npm run build

FROM node:22.13.1-alpine3.21 AS runtime
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 5000
CMD ["npm", "run", "start"]
