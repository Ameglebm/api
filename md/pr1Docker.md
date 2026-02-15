# 🚀 INIT – Configuração Inicial do Projeto  
### Setup de Docker, Containers, Dependências e Ambiente NestJS

Este documento registra toda a configuração e validação do ambiente composto por **PostgreSQL**, **Redis**, **RabbitMQ** e a aplicação **NestJS**, orquestrados via Docker Compose.

---

# 📦 1. Instalação do Docker e Docker Compose

**Método usado:** APT (Ubuntu), utilizando apenas pacotes oficiais.

### 🔧 Instalar Docker
```bash
sudo apt update
sudo apt install docker.io -y
```

### 🔌 Iniciar e habilitar o Docker
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### 🐳 Instalar Docker Compose
```bash
sudo apt install docker-compose -y
```

### 🔍 Verificar versões
```bash
docker -v
docker compose version
```

### ✔ Teste inicial
```bash
docker run hello-world
```

---

# 🛠 2. Criação do docker-compose.yml

Incluindo:
- PostgreSQL  
- Redis  
- RabbitMQ  
- NestJS  
- Rede interna  
- Volumes persistentes  
- Healthchecks  

### 🔌 Portas utilizadas
| Serviço     | Porta |
|-------------|--------|
| PostgreSQL  | 5432   |
| Redis       | 6379   |
| RabbitMQ    | 5672 (painel: 15672) |
| NestJS      | 3000   |

### Comandos essenciais
```bash
docker compose up -d
docker compose up --build -d
docker compose down
docker compose down -v
```

---

# 🧱 3. Containers do Sistema

### 🟦 PostgreSQL – Persistência
```bash
docker exec -it postgres psql -U postgres
```

### 🟥 Redis – Cache / Performance
```bash
docker exec -it redis redis-cli
```

### 🟧 RabbitMQ – Filas / Mensageria
Painel:  
http://localhost:15672

Credenciais padrão:
```
user: guest  
pass: guest
```

### 🟩 NestJS – Aplicação Principal
- API: http://localhost:3000  
- Swagger: http://localhost:3000/api/docs

Subir tudo:
```bash
docker compose up -d
```

---

# 📚 4. Instalação de Dependências (Node)

### 📦 Instalar pacotes
```bash
npm install
```

### 📘 Instalar Swagger (opcional)
```bash
npm install @nestjs/swagger swagger-ui-express
```

---

# 🧪 5. Testes Iniciais dos Containers

```bash
docker logs nest
docker logs postgres
docker logs redis
docker logs rabbitmq
```

---

# 📊 6. Verificar Containers Ativos

```bash
docker ps
docker ps -a
```

---

# 🧹 7. Limpeza de Containers Travados / Portas Ocupadas

### 🔎 Buscar processos por porta
```bash
sudo lsof -i :3000
sudo lsof -i :5432
sudo lsof -i :6379
sudo lsof -i :5672
```

### ❌ Encerrar processo
```bash
sudo kill -9 PID
```

### 🗑 Remover containers
```bash
docker rm CONTAINER_ID
```

### 🧽 Limpar volumes
```bash
docker volume prune
```

---

# 🔍 8. Auditoria de Containers e Imagens

```bash
docker compose config
docker images
```

---

# 🚧 9. Criação do Projeto NestJS

Criar o projeto diretamente na pasta:
```bash
npx @nestjs/cli new . --skip-install
```

---

# 🧼 10. Limpeza do Ambiente Node

```bash
rm -rf node_modules
rm package-lock.json
npm cache clean --force
npm install
```

---

# 🔄 11. Atualização de Pacotes

```bash
npm outdated
npm update
```

---

# ▶ 12. Execução do Projeto

### Rodar localmente
```bash
npm run start:dev
```

### Rodar via Docker
```bash
docker compose up -d
```

---

# 🔁 13. Rebuild Completo

```bash
docker compose down -v
docker compose build
docker compose up -d
```

---

# 🧭 14. Subir Containers em Modo Detached

```bash
docker compose up -d
```

---

# 🟢 15. Verificar Containers Ativos

```bash
docker ps
```

---

# 🔬 16. Testes Individuais e Integrados

### Testar serviços separadamente
```bash
docker compose up postgres
docker compose up redis
docker compose up rabbitmq
docker compose up nest
```

### Testar todo o ecossistema
```bash
docker compose up -d
```

---

