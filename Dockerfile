FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 3000

CMD ["./node_modules/.bin/ts-node-dev", "--respawn", "--transpile-only", "src/main.ts"]