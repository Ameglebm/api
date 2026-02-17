FROM node:20-alpine
# Diretório de trabalho
WORKDIR /app
# Copia package.json e package-lock.json
COPY package*.json ./
# Instala dependências
RUN npm install
# Copia o restante da aplicação
COPY . .
# Expõe a porta da API
EXPOSE 3000
# Gera o Prisma Client com DATABASE_URL fake (valor real vem do .env em runtime)
ARG DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/placeholder
ENV DATABASE_URL=$DATABASE_URL  
RUN rm -rf node_modules/@prisma/client && npx prisma generate
# Comando para rodar em desenvolvimento
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/main.ts"]
