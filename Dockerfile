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
# Comando para rodar em desenvolvimento
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/main.ts"]
