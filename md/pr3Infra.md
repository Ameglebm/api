# 🎬 PR #3 – Feat-Infra: Infraestrutura Base, Schema, Logger, Docker Compose e Boot
### Prisma · Redis · RabbitMQ · Logger · Enums · Filtros · App Root

Terceira PR do projeto. Antes de escrever qualquer linha de negócio, o sistema inteiro foi mapeado — como os serviços se conversam, onde cada responsabilidade vive e qual a ordem certa de construção. Essa PR é o resultado disso: tudo que os próximos módulos precisam pra existir já está ok

> ✅ **Testada:** `GET /health` → 200 OK

---

# 🧠 1. Decisões Tomadas Antes de Codar

A ordem de implementação não foi aleatória. Cada decisão aqui evita retrabalho nas próximas PRs.

### 🏗 Por quê essa stack?

**Prisma** foi escolhido pelo type-safety nativo e migrations versionadas — o schema é a fonte de verdade e o TypeScript sabe disso em tempo de compilação.

**Redis** entra exclusivamente como mecanismo de lock distribuído. A operação `SET NX` é atômica por natureza — não existe race condition nesse nível. O TTL de 30s garante que um lock travado por falha de rede se resolve sozinho, sem intervenção manual.

**RabbitMQ** resolve o problema de processamento assíncrono sem bloquear o fluxo HTTP. A reserva expira, o consumer percebe e libera o assento — tudo sem cron job, sem polling, sem acoplamento.

### 🔀 Fluxo de uma requisição pelo sistema

```
Cliente HTTP
    ↓
Controller     — valida entrada, rejeita o que não faz sentido
    ↓
Service        — regra de negócio, orquestra as dependências
    ├──→ Repository    — queries via Prisma → PostgreSQL
    ├──→ RedisService  — adquire/libera lock atômico
    └──→ Publisher     — enfileira evento no RabbitMQ
                               ↓
                       Consumer — processa em background
```

### 📋 Por quê essa ordem de módulos?

| # | Módulo | Raciocínio |
|---|---|---|
| 1ª | **Infra** (essa PR) | Fundação. Nada funciona sem isso |
| 2ª | **Session** | CRUD puro, valida só o Prisma sem complexidade |
| 3ª | **Seat** | Cruza Postgres + Redis, mas só lê |
| 4ª | **Reservation** | Primeiro lock Redis + primeiro evento |
| 5ª | **Payment** | Orquestra tudo que foi construído antes |
| 6ª | **Sale** | Só leitura — o mais simples, deixado por último |
| 7ª | **Events** | O sistema já funciona sem eles — são camada assíncrona |

### 🛡 Edge cases cobertos no design

- **Race condition** — `SET NX` garante que apenas 1 processo adquire o lock, os outros recebem `409` imediatamente
- **Expiração automática** — TTL de 30s no Redis libera o assento sem depender de nenhuma ação externa
- **Deadlock** — impossível por design: cada reserva trava exatamente 1 assento por vez
- **Fallback de segurança** — `@@unique([sessionId, seatNumber])` no Postgres garante integridade mesmo se o Redis cair

---

# 🐳 2. Docker Compose — 5 Containers

Cada serviço tem seu container isolado comunicando pelo nome na rede `cinema_network`. A API só sobe após o Postgres passar no healthcheck — evita erros de conexão na inicialização.

### 🔌 Containers e portas

| Container | Imagem | Porta(s) | Função |
|---|---|---|---|
| `cinema-api` | build local | `3000` | Aplicação NestJS |
| `cinema-postgres` | `postgres:15` | `5432` | Banco relacional |
| `cinema-redis` | `redis:7` | `6379` | Lock distribuído TTL 30s |
| `cinema-rabbitmq` | `rabbitmq:3-management` | `5672` · `15672` | Mensageria + painel |
| `cinema-prisma-studio` | build local | `5555` | Inspeção visual do banco |

O Prisma Studio aguarda 8s após o Postgres subir antes de conectar — tempo suficiente para as migrations serem aplicadas pela API.

### ▶ Subir o ambiente

```bash
docker compose up --build
```

### 🔧 Comandos do dia a dia

```bash
docker compose up --build        # primeira vez ou após mudança no Dockerfile
docker compose up -d             # background
docker compose down              # derruba mantendo volumes
docker compose down -v           # derruba e apaga o banco
docker compose logs -f cinema-api  # logs da API em tempo real
```

### 🔬 Debug por container

```bash
docker compose up cinema-postgres
docker compose up cinema-redis
docker compose up cinema-rabbitmq
docker compose up cinema-api
```

### 🐚 Acessar por dentro

```bash
docker exec -it cinema-api sh
docker exec -it cinema-postgres psql -U cinema -d cinema
docker exec -it cinema-redis redis-cli
```

---

# 📁 3. Estrutura de Pastas

Definida nessa PR pra guiar todas as próximas. Cada módulo de negócio vai seguir o mesmo padrão de subcamadas.

```
src/
├── main.ts                             # boot: CORS · ValidationPipe · Swagger · banner
├── app.module.ts                       # raiz — importa todos os módulos
├── app.controller.ts                   # GET /health
│
├── common/
│   ├── enums/
│   │   ├── seat-status.enum.ts         # AVAILABLE · RESERVED · SOLD
│   │   └── reservation-status.enum.ts  # PENDING · CONFIRMED · EXPIRED
│   ├── filters/
│   │   └── http-exception.filter.ts    # resposta padronizada pra erros HTTP
│   └── logger/
│       ├── logger.service.ts           # 4 níveis · badge ANSI · JSON opcional
│       └── logger.module.ts            # @Global() — injetável em qualquer lugar
│
├── infra/
│   ├── prisma/
│   │   ├── prisma.service.ts           # PrismaPg adapter · connect/disconnect
│   │   └── prisma.module.ts
│   ├── redis/
│   │   ├── redis.service.ts            # acquireLock · releaseLock · isLocked
│   │   └── redis.module.ts
│   └── rabbitmq/
│       ├── rabbitmq.service.ts         # connect · publish · consume · DLQ · prefetch
│       └── rabbitmq.module.ts
│
├── events/
│   ├── publishers/
│   │   ├── reservation.publisher.ts
│   │   └── payment.publisher.ts
│   └── consumers/
│       ├── reservation.consumer.ts
│       └── payment.consumer.ts
│
└── models/
    ├── session/
    │   ├── controller/
    │   ├── dtos/
    │   ├── interface/
    │   ├── repository/
    │   ├── service/
    │   └── session.module.ts
    ├── seat/
    ├── reservation/
    ├── payment/
    └── sale/

prisma/
├── schema.prisma
└── migrations/
    └── 20260217135942_init/
```

---

# 🗄 4. Schema Prisma — 4 Models

O schema foi desenhado pra refletir exatamente o ciclo de vida de uma venda: `Session → Seat → Reservation → Sale`.

### 📋 Session — raiz
Filme + sala + horário + preço. Ao ser criada, gera os assentos vinculados. Sem sessão, nada mais existe.

### 💺 Seat — recurso disputado
Cada assento pertence a uma sessão. O `@@unique([sessionId, seatNumber])` impede duplicata no nível do banco — fallback caso o Redis esteja indisponível. Status: `AVAILABLE → RESERVED → SOLD`.

### 🎟 Reservation — intenção temporária
`expiresAt = now() + 30s`. Se o pagamento não chegar nessa janela, o consumer libera o assento automaticamente. Começa `PENDING`, termina `CONFIRMED` ou `EXPIRED`.

### 💰 Sale — registro permanente
Criada apenas após pagamento confirmado. `reservationId @unique` — impossível criar duas vendas da mesma reserva.

### 🔢 Enums (em `src/common/enums/`)

```
SeatStatus:         AVAILABLE · RESERVED · SOLD
ReservationStatus:  PENDING   · CONFIRMED · EXPIRED
```

Centralizados em `common/` pra serem compartilhados entre os módulos sem duplicação.

### 🔧 Comandos Prisma

```bash
# Aplicar migration
docker exec -it cinema-api npx prisma migrate dev --name init

# Inspecionar banco visualmente
docker exec -it cinema-api npx prisma studio --port 5555 --browser none
# → http://localhost:5555
```

---

# ⚙️ 5. Infra Base — O que cada serviço faz

### 🐘 Prisma
Adapter `PrismaPg` com hooks de `onModuleInit` e `onModuleDestroy` — a conexão abre e fecha junto com o ciclo de vida do container. Exportado globalmente: os repositories injetam `PrismaService` direto, sem reimportar módulo.

### ⚡ Redis — Lock Distribuído
Três operações, cada uma com responsabilidade clara:

```typescript
acquireLock(key)   // SET NX PX 30000 — atômico, retorna true se adquiriu
releaseLock(key)   // DEL — chamado após pagamento confirmado
isLocked(key)      // EXISTS — usado no GET /seats para status em tempo real
```

O TTL é o mecanismo de expiração automática. Se a API cair no meio de uma reserva, o Redis limpa sozinho em 30s.

### 🐇 RabbitMQ
`prefetch(1)` configurado — cada consumer processa 1 mensagem por vez, sem sobrecarga. DLQ configurada: mensagens que falham 3 vezes vão pra fila separada com backoff exponencial, sem perda de evento.

---

# 📝 6. Logger Customizado

O logger padrão do NestJS foi desativado no `NestFactory` — ele loga internals do framework que não agregam nada durante desenvolvimento ou avaliação.

O `LoggerService` customizado tem saída dupla: colorida no terminal pra leitura humana e JSON estruturado quando `LOG_JSON=true` no `.env` — compatível com qualquer agregador de logs (Datadog, ELK, etc).

```typescript
// Injeção em qualquer service
constructor(private readonly logger: LoggerService) {
  this.logger.setContext('SessionService');
}

this.logger.log('Sessão criada', { sessionId, totalSeats });
this.logger.warn('Assento já bloqueado', { seatId });
this.logger.error('Falha na transação', trace, { sessionId });
```

Módulo decorado com `@Global()` — registrado uma vez no `AppModule`, disponível em toda a aplicação.

---

# 🚀 7. Boot da Aplicação

### 📍 URLs disponíveis após subir

| Recurso | URL |
|---|---|
| API | http://localhost:3000 |
| Health Check | http://localhost:3000/health |
| Swagger | http://localhost:3000/api/docs |
| RabbitMQ UI | http://localhost:15672 · `guest / guest` |
| Prisma Studio | http://localhost:5555 |

---

# 🧪 8. Testes e Validação

```bash
# Containers ativos
docker ps

# Logs por serviço
docker logs cinema-api
docker logs cinema-postgres
docker logs cinema-redis
docker logs cinema-rabbitmq

# Health da API
curl http://localhost:3000/health
# → 200 OK ✅
```

---

# ✅ 9. Checklist

- [x] `docker compose up --build` sobe todos os 5 containers
- [x] Healthchecks passando — Postgres e RabbitMQ
- [x] Migrations aplicadas e schema sincronizado
- [x] `acquireLock` · `releaseLock` · `isLocked` funcionando
- [x] RabbitMQ com DLQ e prefetch configurados
- [x] Logger `@Global()` injetável sem reimportar
- [x] `HttpExceptionFilter` registrado globalmente no `main.ts`
- [x] `ValidationPipe` com `whitelist` e `forbidNonWhitelisted`
- [x] Sem providers duplicados no `AppModule`
- [x] `GET /health` → 200 OK

---

# 🧹 10. Limpeza e Troubleshooting

```bash
# Porta ocupada
sudo lsof -i :3000 && sudo kill -9 PID

# Container travado
docker rm CONTAINER_ID

# Rebuild do zero
docker compose down -v
docker compose build
docker compose up -d

# Node limpo
rm -rf node_modules && rm package-lock.json
npm cache clean --force && npm install
```
---
*PR #3 · @you · status: aguardando revisão*