FROM node:20-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .

RUN yarn nest build api-gateway
RUN yarn nest build core-service
RUN yarn nest build review-service
RUN yarn nest build ai-service
RUN yarn nest build integration-service

CMD ["node", "dist/apps/api-gateway/main.js"]