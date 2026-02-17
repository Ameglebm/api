# 🎬 PR #2 – Base da Arquitetura: Cinema Ticket API
### Planejamento, Infraestrutura, Schema, Logger, Docker Compose e Boot

Segunda PR do projeto. Antes de escrever qualquer linha de código, foi feito um mapa mental de como o sistema inteiro deveria funcionar — do fluxo de uma requisição até como os serviços se comunicam. Com isso definido, a PR implementa toda a base que as próximas precisam pra existir: banco, cache, fila de mensagens, ambiente Docker e a aplicação NestJS no ar.

> ✅ **Testada:** `GET /health` → 200 OK

---

# 🧠 1. Mapa Mental — Planejamento da Arquitetura

Antes de qualquer implementação, foi feito um mapa mental pra entender como as peças se encaixam e definir a ordem certa de construção. Partir do código sem essa visão causaria retrabalho — um módulo dependendo de outro que ainda não existe.

### 🔀 Como uma requisição percorre o sistema

O fluxo segue um caminho arquitetura por camadas, com dois processos acontecendo em paralelo no nível do Service:

```
Cliente HTTP
    ↓
Controller  — valida a entrada via DTOs, rejeita o que não faz sentido
    ↓
Service     — aqui fica a regra de negócio de verdade
    ↓
Repository  — traduz as operações em queries via Prisma
    ↓
PostgreSQL  — fonte de verdade, onde os dados persistem

Em paralelo, o Service também:
    ──→ RedisService    — tenta adquirir o lock atômico (SET NX · TTL 30s)
    ──→ Publisher       — enfileira evento no RabbitMQ
                              ↓
                    Consumer — processa em background, sem bloquear a resposta
```

Cada camada tem uma responsabilidade única: o Controller não sabe de banco, o Repository não sabe de regra de negócio, os eventos são completamente assíncronos e não afetam o fluxo principal, service e repository tem q estar com contrato definido para exercutr algo.

---

### 📋 Ordem de implementação 

A ordem não foi aleatória — cada etapa foi pensada para que o módulo anterior valide o funcionamento antes do próximo ser construído em cima dele:

| # | Módulo | Por quê nessa ordem |
|---|---|---|
| 1ª | **Infra base** (Prisma, Redis, RabbitMQ) | Tudo depende disso. Sem conexão com banco, nada funciona |
| 2ª | **Session** | CRUD puro, sem Redis nem eventos. Valida só o Prisma |
| 3ª | **Seat** | Cruza Postgres + Redis, mas só lê. Próximo nível de complexidade |
| 4ª | **Reservation** | Aqui entra o lock Redis e o primeiro evento. Race condition é resolvida aqui |
| 5ª | **Payment** | Orquestra tudo: valida, cria Sale, atualiza Seat, remove lock, publica evento |
| 6ª | **Sale** | Só leitura de histórico. O mais simples, deixado por último de propósito |
| 7ª | **Events** | Publishers + Consumers. O sistema já funciona sem eles — são melhoria assíncrona |

---

### 🏗 Decisões de arquitetura

Algumas decisões importantes foram tomadas nessa etapa de planejamento:

**Por quê Redis + Postgres juntos?**
O Redis faz o lock temporário (30s) de forma atômica e rápida, sem escrita no banco. O Postgres é a verdade final, com `@@unique([sessionId, seatNumber])` como fallback — se o Redis cair, o banco ainda impede venda dupla.

**Por quê RabbitMQ?**
Para eventos assíncronos. Quando uma reserva expira, o consumer libera o assento e remove o lock sem precisar de cron job. O fluxo HTTP não fica esperando isso acontecer.

**Por quê separar Payment de Sale?**
Payment orquestra — valida, cria a venda, atualiza o assento, remove o lock. Sale só armazena o registro permanente. Responsabilidade única em cada módulo.

**Edge cases cobertos no planejamento:**

- ✅ **Race condition** — `SET NX` no Redis garante que só 1 processo adquire o lock
- ✅ **Expiração** — TTL de 30s libera o assento automaticamente
- ✅ **Deadlock** — impossível: cada reserva trava 1 assento por vez, sem ordem entre locks
- ✅ **Idempotência** — segunda tentativa no mesmo assento recebe `409 Conflict`

---

# 🐳 2. Docker Compose — 5 Containers

Tudo roda via Docker desde o início pra evitar o problema clássico de "funciona na minha máquina". Cada serviço tem seu container isolado e se comunicam pela rede interna `cinema_network` — pelo nome do serviço, não por IP.

### 🔌 Portas utilizadas

| Serviço | Container | Porta(s) | Função |
|---|---|---|---|
| NestJS API | `cinema-api` | `3000` | Aplicação principal |
| PostgreSQL | `cinema-postgres` | `5432` | Banco relacional, fonte de verdade |
| Redis | `cinema-redis` | `6379` | Lock atômico TTL 30s |
| RabbitMQ | `cinema-rabbitmq` | `5672` · `15672` (UI) | Message broker + painel de inspeção |
| Prisma Studio | `cinema-prisma-studio` | `5555` | Inspeção visual das tabelas durante testes |

O Prisma Studio foi adicionado como container separado pra facilitar a inspeção do banco durante avaliação. Ele aguarda 8 segundos após o Postgres subir pra garantir que as migrations já foram aplicadas antes de tentar conectar.

### ▶ Subir o ambiente completo

```bash
docker compose up --build
```

A API não sobe antes do Postgres estar saudável — o `healthcheck` usa `pg_isready` e só libera a API depois que o check passa. Isso evita erros de conexão na inicialização.

### 🔧 Comandos essenciais

```bash
docker compose up --build        # primeira vez ou após mudanças no Dockerfile
docker compose up -d             # modo detached (roda em background)
docker compose down              # derruba os containers mantendo os volumes
docker compose down -v           # derruba e apaga os volumes (banco zerado)
docker compose logs -f api       # acompanhar logs da API em tempo real
```

### 🔬 Subir containers individualmente (debug)

```bash
docker compose up postgres
docker compose up redis
docker compose up rabbitmq
docker compose up api
```

### 🐚 Acessar os serviços por dentro do Docker

```bash
# Abrir terminal dentro da API
docker exec -it cinema-api sh

# Acessar o PostgreSQL diretamente
docker exec -it cinema-postgres psql -U cinema -d cinema

# Acessar o Redis CLI
docker exec -it cinema-redis redis-cli

# Rodar Prisma Studio manualmente dentro do container da API
docker exec -it cinema-api npx prisma studio --port 5555 --browser none
# → acesse http://localhost:5555
```

---

# 📁 3. Estrutura de Pastas

A estrutura foi definida nesta PR para guiar toda a implementação das próximas. Cada módulo de negócio segue o mesmo padrão de subcamadas — quem entrar no projeto sabe exatamente onde encontrar cada coisa.

```
src/
├── main.ts                        # boot da aplicação
├── app.module.ts                  # módulo raiz, importa todos os outros
├── app.controller.ts              # health check
│
├── common/                        # compartilhado por toda a aplicação
│   ├── enums/
│   │   ├── seat-status.enum.ts         # AVAILABLE · RESERVED · SOLD
│   │   └── reservation-status.enum.ts  # PENDING · CONFIRMED · EXPIRED
│   ├── filters/
│   │   └── http-exception.filter.ts    # tratamento global de erros HTTP
│   └── logger/
│       ├── logger.service.ts      # logger customizado com níveis e cores
│       └── logger.module.ts       # módulo global, injetável em qualquer lugar
│
├── infra/                         # serviços de infraestrutura base
│   ├── prisma.service.ts          # conexão com PostgreSQL via Prisma
│   └── prisma.module.ts           # módulo exportado para os repositories
│
├── events/                        # eventos assíncronos via RabbitMQ
│   ├── publishers/
│   │   ├── reservation.publisher.ts   # publica reservation.created
│   │   └── payment.publisher.ts       # publica payment.confirmed
│   └── consumers/
│       ├── reservation.consumer.ts    # libera assento expirado
│       └── payment.consumer.ts        # processa confirmação de pagamento
│
└── models/                        # módulos de negócio
    ├── session/                   # CRUD de sessões de cinema
    │   ├── controller/
    │   ├── dtos/                  # create · response · update
    │   ├── interface/             # contratos do repository e service
    │   ├── repository/            # queries Prisma
    │   ├── service/               # lógica de negócio
    │   └── session.module.ts
    ├── seat/                      # assentos — recurso disputado
    ├── reservation/               # reservas temporárias com lock Redis
    ├── payment/                   # orquestrador do fluxo de compra
    └── sale/                      # registro permanente de vendas
        └── (mesma estrutura em todos)

prisma/
├── schema.prisma                  # definição dos models e enums
└── migrations/
    └── 20260217135942_init/
        └── migration.sql          # primeira migration gerada
```

---

# 🗄 4. Schema Prisma — 4 Models

O schema reflete o ciclo de vida de uma venda: uma **Sessão** tem **Assentos**, um Assento pode ter uma **Reserva temporária**, e se o pagamento vier a tempo vira uma **Venda permanente**.

### 📋 Session

Raiz de tudo. Representa um filme em uma sala em um horário específico. Ao ser criada, gera automaticamente todos os assentos vinculados (mínimo 16). Sem sessão, nada mais existe no sistema.

Campos: `movie`, `room`, `startsAt`, `ticketPrice` e a relação `seats[]`.

### 💺 Seat

O recurso disputado — é o assento que múltiplos usuários tentam reservar ao mesmo tempo. O `status` evolui: `AVAILABLE → RESERVED → SOLD`.

O `@@unique([sessionId, seatNumber])` é o fallback de segurança: se o Redis cair, o Postgres ainda impede que dois processos vendam o mesmo assento na mesma sessão.

### 🎟 Reservation

A intenção de compra — temporária por natureza. O `expiresAt` é `now() + 30 segundos`. Se o pagamento não chegar nessa janela, a reserva expira, o lock no Redis é liberado automaticamente e o assento volta a ficar disponível.

Status: começa em `PENDING`, vai pra `CONFIRMED` com pagamento ou `EXPIRED` se o tempo acabar.

### 💰 Sale

O registro definitivo e permanente da venda. Só existe depois do pagamento confirmado. Guarda referência à Reservation de origem e ao Seat comprado — o que permite rastrear o histórico de qualquer usuário via `userId`. O `reservationId` é `@unique`: uma reserva só pode virar uma venda.

### 🔢 Enums

Definidos em `src/common/enums/` pra serem compartilhados entre os módulos sem duplicação.

```
SeatStatus:         AVAILABLE · RESERVED · SOLD
ReservationStatus:  PENDING   · CONFIRMED · EXPIRED
```

### 🔧 Comandos Prisma

```bash
# Gerar a migration inicial (usado nessa PR)
docker exec -it cinema-api npx prisma migrate dev --name init

# Abrir Prisma Studio para inspecionar o banco visualmente
docker exec -it cinema-api npx prisma studio --port 5555 --browser none
# → acesse http://localhost:5555
```

---

# 📚 5. Dependências Instaladas

> ⚠️ **Instalar sempre fora do Docker**, no terminal normal. O container copia o `node_modules` gerado durante o `build`. Instalar dentro do container com `docker exec` não persiste — some no próximo `down`.

```bash
# fluxo correto para adicionar qualquer pacote novo
npm install nome-do-pacote
docker compose up --build   # rebuilda para o container pegar o pacote
```

### 🔌 Swagger

```bash
npm install @nestjs/swagger swagger-ui-express
```

Gera a documentação dos endpoints automaticamente a partir dos DTOs e decorators. Disponível em `http://localhost:3000/api/docs` assim que a API sobe.

### 🧰 Prisma

```bash
npm install prisma @prisma/client
```

Escolhido pela combinação de type-safety, migrations versionadas e Prisma Studio para inspeção visual — especialmente útil durante desenvolvimento e testes.

---

# 📝 6. Logger Customizado

O logger padrão do NestJS foi silenciado (`logger: false` no `NestFactory`) porque polui demais os logs com ruído interno do framework. No lugar foi criado um `LoggerService` customizado em `src/common/logger/`.

### 🎨 O que foi adicionado e por quê

Um logger com 4 níveis (`DEBUG`, `INFO`, `WARN`, `ERROR`), cada um com ícone e cor ANSI no terminal. O output tem saída dupla: versão colorida pra leitura humana no console e, se `LOG_JSON=true` no `.env`, um JSON estruturado em paralelo pra parsers e agregadores de log.

O módulo é `@Global()` — importado uma vez no `AppModule` e injetável em qualquer service da aplicação sem precisar reimportar em cada módulo.

```typescript
// Como usar em qualquer service
constructor(private readonly logger: LoggerService) {
  this.logger.setContext('ReservationService');
}

this.logger.log('Reserva criada', { seatId, userId });
this.logger.warn('Tentativa de lock em assento já reservado', { seatId });
this.logger.error('Falha ao publicar evento', trace, { reservationId });
```

---

# 🚀 7. Boot da Aplicação — main.ts

O `main.ts` foi ajustado pra ter um boot limpo com tudo configurado globalmente antes de qualquer requisição chegar.

### ✔ O que foi configurado e por quê

**CORS** em `*` — em dev qualquer origem acessa. Em produção restringir pros domínios do frontend.

**ValidationPipe global** com `whitelist: true` e `forbidNonWhitelisted: true` — campos fora do DTO são removidos automaticamente, campos desconhecidos retornam erro. Dado inesperado não chega nos services.

**Swagger** em `/api/docs` com tags por módulo pra organizar a documentação automaticamente.

**Banner no boot** com links OSC 8 clicáveis — em terminais compatíveis (iTerm2, Warp, Windows Terminal) as URLs viram links clicáveis direto no terminal.

### 📍 O que está disponível após o boot

| Recurso | URL |
|---|---|
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/api/docs |
| RabbitMQ UI | http://localhost:15672 |
| Prisma Studio | http://localhost:5555 |

```
RabbitMQ UI — credenciais padrão
user: guest  ·  pass: guest
```

---

# 🧪 8. Testes e Validação

### 🔬 Verificar containers ativos

```bash
docker ps        # containers rodando
docker ps -a     # todos, incluindo parados
```

### 📋 Acompanhar logs

```bash
docker logs cinema-api
docker logs cinema-postgres
docker logs cinema-redis
docker logs cinema-rabbitmq
```

### ✔ Testar health da API

```bash
curl http://localhost:3000/health
# → 200 OK ✅
```

---

# 🧹 9. Limpeza e Troubleshooting

### 🔎 Verificar porta ocupada

```bash
sudo lsof -i :3000
sudo lsof -i :5432
sudo lsof -i :6379
sudo lsof -i :5672
```

### ❌ Encerrar processo na porta

```bash
sudo kill -9 PID
```

### 🗑 Remover container travado

```bash
docker rm CONTAINER_ID
```

### 🔁 Rebuild completo do zero

```bash
docker compose down -v
docker compose build
docker compose up -d
```

### 🧽 Limpar ambiente Node local

```bash
rm -rf node_modules
rm package-lock.json
npm cache clean --force
npm install
```
---

*PR #2 · @you · status: aguardando revisão*