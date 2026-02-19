# 🎬 Cinema API — Backend

![Visão geral do sistema](./md/cinemaApi.png)

O **Cinema API** é um backend projetado para **gerenciar sessões de cinema**, controlando:
- 🎥 Filmes
- 🕒 Sessões
- 🏛️ Salas
- 🎫 Tickets
- 👥 Clientes

A aplicação foi desenvolvida com foco em **escalabilidade, modularidade e alta performance**, seguindo uma arquitetura clara e previsível para facilitar manutenção e evolução.

---

## 🔗 Visão Geral da Arquitetura
Abaixo está o diagrama completo do fluxo interno da aplicação:

👉 **[Arquitetura](https://arqt-cinema-api.vercel.app)**

---

## 📚 Sobre o Sistema
Uma explicação detalhada sobre o conceito, regras de negócio e funcionamento geral do Cinema API:

👉 **[Sobre o sistema](https://sobre-cinema-api.vercel.app)**

---

## 🏗️ Stack Tecnológica

- **NestJS** — Estrutura modular e altamente escalável  
- **Prisma ORM** — Mapeamento de banco fortemente tipado  
- **PostgreSQL** — Persistência confiável  
- **Redis** — Locks e caching temporário  
- **RabbitMQ** — Processamento assíncrono via filas  
- **Docker Compose** — Orquestração completa para ambiente local  

---

## 🧠 Filosofia Arquitetural
Backend construído com foco em:

- 🔒 **Isolamento de responsabilidades**  
- ♻️ **Reutilização real de módulos**  
- 🚦 **Fluxos previsíveis (Controller → Service → Repository)**  
- ⚡ **Eventos assíncronos processados em background**  
- 🧩 **Interfaces TypeScript para garantir contratos estáveis**  

O objetivo é:  
**reduzir retrabalho, padronizar processos e garantir previsibilidade em cada feature.**

---

## 📦 Estrutura do Projeto
## 🏗️ Stack

| Tecnologia | Função |
|---|---|
| **NestJS** | Framework principal — arquitetura modular |
| **PostgreSQL** | Persistência — fonte de verdade |
| **Prisma ORM** | Acesso ao banco com type-safety |
| **Redis** | Lock distribuído com TTL de 30s |
| **RabbitMQ** | Eventos assíncronos em background |
| **Docker Compose** | Orquestração completa do ambiente |

---

## 🚀 Subir o ambiente

```bash
docker compose up --build
```

### URLs disponíveis

| Recurso | URL |
|---|---|
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/api/docs |
| RabbitMQ UI | http://localhost:15672 (`guest / guest`) |
| Prisma Studio | http://localhost:5555 |
| Portainer | http://localhost:9000 |

---

## 🔀 Fluxo de uma requisição

```
Cliente HTTP
    ↓
Controller     — valida entrada via DTO
    ↓
Service        — regra de negócio
    ├──→ Repository    — queries Prisma → PostgreSQL
    ├──→ RedisService  — adquire/libera lock atômico
    └──→ Publisher     — enfileira evento no RabbitMQ
                               ↓
                       Consumer — processa em background
```

---

## 📦 Módulos

### ⚙️ Infra Base
Prisma (PostgreSQL), Redis e RabbitMQ inicializados e prontos. O Redis expõe `acquireLock`, `releaseLock` e `isLocked`. O RabbitMQ tem DLQ e `prefetch(1)` configurados.

### 🎬 Session
CRUD completo de sessões. Ao criar uma sessão, os assentos são gerados automaticamente em fileiras de 8 (`A1–A8`, `B1–B8`...). Mínimo de 16 assentos por sessão.

### 💺 Seat
Consulta de disponibilidade em tempo real: cruza o status persistido no Postgres com os locks ativos no Redis usando `Promise.all` para performance paralela.

### 🎟️ Reservation
Reserva com lock atômico Redis (`SET NX EX 30`). Dois usuários tentando o mesmo assento simultaneamente: um recebe `201`, o outro recebe `409 Conflict`. A reserva expira automaticamente em 30 segundos se o pagamento não chegar.

### 💳 Payment
Módulo orquestrador. Confirma o pagamento dentro de uma transaction atômica no Prisma: `Reservation → CONFIRMED`, `Seat → SOLD`, cria `Sale`. Redis e RabbitMQ ficam fora da transaction — se falharem, o TTL e a DLQ resolvem sem inconsistência.

### 💰 Sale
Histórico de compras por usuário. Query com `include` encadeado: `Sale → Reservation → Seat → Session`, trazendo todos os dados em uma única chamada ao banco.

### 📡 Events (Publishers + Consumers)
- `ReservationPublisher` — publica `reservation.created`
- `PaymentPublisher` — publica `payment.confirmed`
- `ReservationConsumer` — escuta a fila, aguarda o `expiresAt` e expira a reserva automaticamente se ainda `PENDING`
- `PaymentConsumer` — processa confirmações de venda em background

### 🪵 Logger
Logger customizado com badge e cor por módulo, nível de log (`INFO`, `WARN`, `ERROR`, `DEBUG`), interceptor global para requests 2xx e filter global para erros 4xx/5xx. Suporta `LOG_JSON=true` para ambientes de produção.

---

## 🛡️ Controle de concorrência

O problema central — dois usuários tentando comprar o mesmo assento — é resolvido em duas camadas:

1. **Redis** — `SET NX EX 30` é atômico. Apenas um processo adquire o lock; os demais recebem `409` imediatamente.
2. **PostgreSQL** — `@@unique([sessionId, seatNumber])` como fallback. Se o Redis cair, o banco ainda impede venda dupla.

Edge cases cobertos:
- Race condition → `SET NX` garante exclusividade
- Expiração → TTL de 30s libera o assento sem intervenção
- Deadlock → impossível: cada reserva trava exatamente 1 assento
- Idempotência → segunda tentativa retorna `409 Conflict`

---

## 🧪 Testes

```bash
npx jest --verbose
```

**88 testes · 11 suites · 0 falhas**

| Camada | O que cobre |
|---|---|
| `unit/` | Lógica isolada de cada service (sem I/O real) |
| `contract/` | Shape e status codes dos controllers |
| `flow/` | Fluxos completos — race condition e expiração automática |

Cobertura dos services: **100%**. O `reservation.consumer` ficou em 94%.

---

## 📋 Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/sessions` | Cria sessão + gera assentos |
| `GET` | `/sessions` | Lista sessões |
| `GET` | `/sessions/:id` | Sessão com assentos |
| `GET` | `/seats/:sessionId` | Disponibilidade em tempo real |
| `POST` | `/reservations` | Reserva com lock Redis |
| `GET` | `/reservations/:id` | Busca reserva |
| `GET` | `/reservations/user/:userId` | Histórico por usuário |
| `POST` | `/payments/confirm/:reservationId` | Confirma pagamento |
| `GET` | `/sales/history/:userId` | Histórico de vendas |

---

## 🔧 Comandos úteis

```bash
# Rebuild completo
docker compose down -v && docker compose up --build

# Logs da API em tempo real
docker compose logs -f cinema-api

# Acessar banco direto
docker exec -it cinema-postgres psql -U cinema -d cinema

# Acessar Redis CLI
docker exec -it cinema-redis redis-cli

# Rodar testes
npx jest --verbose

# Cobertura dos services
npx jest test/unit/ --coverage

# Lint
npx eslint src/

# Formatar
npm run format
``` 
