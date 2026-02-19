# 🎬 Cinema API — Backend

![Visão geral do sistema](./md/cinemaApi.png)

Sistema de venda de ingressos para uma rede de cinemas, desenvolvido como solução para o desafio técnico de Back-End Node.js/NestJS — Sistemas Distribuídos.

O problema central do desafio é real e acontece em produção todo dia: **múltiplos usuários tentando comprar o mesmo assento ao mesmo tempo**, com múltiplas instâncias da aplicação rodando em paralelo. Uma verificação ingênua de disponibilidade — ler o banco, ver que está livre, então gravar — cria uma janela de tempo onde dois processos passam pela leitura antes de qualquer escrita acontecer. O resultado é venda dupla.

A solução implementada resolve isso em **duas camadas independentes**: um lock atômico no Redis que elimina a race condition antes mesmo de chegar ao banco, e uma constraint `@@unique` no PostgreSQL que funciona como fallback caso o Redis esteja indisponível. As reservas expiram automaticamente em 30 segundos via TTL no Redis e via consumer assíncrono no RabbitMQ — sem cron job, sem polling. Todos os edge cases do desafio foram cobertos: race condition, deadlock, idempotência e expiração automática.

Os diferenciais opcionais também foram implementados: **Swagger** em `/api/docs`, **testes com 88 casos e 100% de cobertura nos services**, **Dead Letter Queue** com retry e backoff exponencial no RabbitMQ, e **logging estruturado** com níveis `DEBUG`, `INFO`, `WARN` e `ERROR`, saída colorida no terminal e JSON estruturado para ambientes de produção.

---

## 🔗 Visão Geral da Arquitetura

👉 **[Diagrama interativo](https://arqt-cinema-api.vercel.app)**

## 📚 Sobre o Sistema

👉 **[Documentação detalhada](https://sobre-cinema-api.vercel.app)**

---

## 🏗️ Tecnologias Escolhidas

| Tecnologia | Função | Por quê |
|---|---|---|
| **NestJS** | Framework principal | Arquitetura modular, injeção de dependência nativa, suporte a decorators — ideal para separar responsabilidades em Controllers, Services e Repositories |
| **PostgreSQL** | Banco relacional | Fonte de verdade. A constraint `@@unique([sessionId, seatNumber])` funciona como fallback de segurança contra venda dupla, mesmo se o Redis cair |
| **Prisma ORM** | Acesso ao banco | Type-safety nativo, migrations versionadas e Prisma Studio para inspeção visual durante desenvolvimento |
| **Redis** | Lock distribuído | `SET NX EX` é atômico por natureza — elimina race conditions sem necessidade de transação no banco. TTL de 30s garante liberação automática sem intervenção |
| **RabbitMQ** | Mensageria assíncrona | Desacopla o fluxo HTTP dos efeitos colaterais. A expiração de reservas acontece via consumer sem cron job. DLQ e retry com backoff exponencial incluídos |
| **Docker Compose** | Orquestração | Ambiente completo em um único comando, com healthchecks garantindo ordem de inicialização |

---

## ⬇️ Como Executar

### Pré-requisitos

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) + [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) v18+

### 1. Clonar o repositório

```bash
git clone https://github.com/Ameglebm/api.git
cd api
```

### 2. Instalar as dependências

```bash
npm install
```

### 3. Subir o ambiente

```bash
docker-compose down -v && docker-compose up --build
```

> Derruba containers anteriores, limpa volumes, rebuilda as imagens e sobe todos os serviços. A API só inicializa após o PostgreSQL passar no healthcheck — sem erros de conexão na inicialização.

### 4. Gerar o Prisma Client

```bash
npx prisma generate
```

> Execute dentro da pasta `api/`. Sincroniza os types do Prisma com o schema atual.

### ✅ Tudo pronto — suba o ambiente

```bash
docker-compose up
```

A API estará disponível em `http://localhost:3000`.

---

## 🚀 URLs disponíveis

| Recurso | URL | Para que serve |
|---|---|---|
| API | http://localhost:3000 | Endpoints da aplicação |
| Health Check | http://localhost:3000/health | Verificar se a API está no ar |
| Swagger | http://localhost:3000/api/docs | Documentação interativa dos endpoints |
| RabbitMQ UI | http://localhost:15672 (`guest / guest`) | Inspecionar filas, mensagens e consumers em tempo real |
| Prisma Studio | http://localhost:5555 | Visualizar e inspecionar o banco de dados |
| Portainer | http://localhost:9000 | Gerenciar containers, logs e status Docker via interface web |

---

## 🛡️ Estratégias Implementadas

### Race Condition

O problema: dois usuários clicam no último assento no mesmo milissegundo. Se a verificação fosse uma leitura seguida de escrita, ambos passariam pela leitura antes de qualquer escrita acontecer.

**Solução: `SET NX EX` no Redis**

```
Usuario A → SET seat:{id} NX EX 30 → OK   → cria reserva → 201
Usuario B → SET seat:{id} NX EX 30 → FAIL → 409 Conflict
```

`SET NX` é uma operação **atômica** no Redis — verificar e setar acontecem em uma única instrução indivisível. Não existe janela entre "verificar se existe" e "criar a chave" onde um segundo processo possa entrar.

**Fallback:** mesmo que o Redis esteja indisponível, a constraint `@@unique([sessionId, seatNumber])` no PostgreSQL impede que dois registros com a mesma sessão e número de assento sejam criados.

---

### Coordenação entre múltiplas instâncias

O lock não fica na memória da aplicação — fica no **Redis**, que é externo e compartilhado. Qualquer instância da API que tentar adquirir o lock para o mesmo assento vai consultar o mesmo Redis e receber `FAIL` se o lock já existir.

```
Instância A (pod 1) → acquireLock(seatId) → OK
Instância B (pod 2) → acquireLock(seatId) → FAIL → 409
Instância C (pod 3) → acquireLock(seatId) → FAIL → 409
```

---

### Deadlock

O cenário clássico: usuário A trava assento 1 e tenta o 3, usuário B trava assento 3 e tenta o 1 — ambos esperando um pelo outro infinitamente.

**Por que não ocorre aqui:** cada endpoint de reserva trava **exatamente 1 assento por requisição**. Não existe operação que precise adquirir múltiplos locks em sequência — portanto, a condição necessária para deadlock nunca se forma.

---

### Expiração automática

O TTL de 30s no Redis libera o lock automaticamente se a aplicação cair no meio de uma reserva. Em paralelo, o `ReservationConsumer` escuta a fila `reservations` e, ao receber `reservation.created`, calcula o tempo restante até `expiresAt` e aguarda esse intervalo exato antes de verificar o status:

```
Consumer recebe mensagem → calcula (expiresAt - now) → sleep → verifica status
PENDING  → Reservation:EXPIRED + Seat:AVAILABLE + publica reservation.expired
CONFIRMED → ignora (pagamento já chegou a tempo)
```

Sem cron job, sem polling — cada consumer sabe exatamente quando agir.

---

### Idempotência

Segunda tentativa de reserva no mesmo assento dentro da janela de 30s retorna `409 Conflict`. Tentar confirmar o pagamento de uma reserva já confirmada retorna `409`. Tentar confirmar uma reserva expirada retorna `410 Gone`.

---

## 📁 Estrutura do Projeto

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
│   │   └── http-exception.filter.ts    # resposta padronizada para erros HTTP
│   ├── interceptors/
│   │   └── logging.interceptor.ts      # captura todas as requests 2xx globalmente
│   └── logger/
│       ├── logger.service.ts           # 4 níveis · badge ANSI · JSON opcional
│       └── logger.module.ts            # @Global() — injetável em qualquer lugar
│
├── infra/
│   ├── prisma/
│   │   ├── prisma.service.ts
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
│   │   ├── reservation.publisher.ts    # publica reservation.created
│   │   └── payment.publisher.ts        # publica payment.confirmed
│   └── consumers/
│       ├── reservation.consumer.ts     # expira reserva após 30s automaticamente
│       └── payment.consumer.ts         # processa confirmações em background
│
└── models/
    ├── session/                        # CRUD de sessões + geração de assentos
    ├── seat/                           # disponibilidade em tempo real
    ├── reservation/                    # reserva com lock Redis
    ├── payment/                        # orquestrador do fluxo de compra
    └── sale/                           # histórico de vendas

prisma/
├── schema.prisma
└── migrations/
    └── 20260217135942_init/

requests/                               # arquivos de teste com REST Client
├── health.http
├── sessions.http
├── seats.http
├── reservations.http
├── payments.http
├── sales.http
└── events.http
```

---

## 🔀 Fluxo de uma requisição

```
Cliente HTTP
    ↓
Controller     — valida entrada via DTO, rejeita o que não faz sentido
    ↓
Service        — regra de negócio, orquestra as dependências
    ├──→ Repository    — queries Prisma → PostgreSQL
    ├──→ RedisService  — adquire/libera lock atômico
    └──→ Publisher     — enfileira evento no RabbitMQ
                               ↓
                       Consumer — processa em background, sem bloquear a resposta
```

---

## 📦 Módulos

### ⚙️ Infra Base
Prisma (PostgreSQL), Redis e RabbitMQ inicializados com hooks de ciclo de vida do NestJS. O Redis expõe `acquireLock`, `releaseLock` e `isLocked`. O RabbitMQ tem DLQ configurada (mensagens que falham 3 vezes são movidas para fila separada) e `prefetch(1)` para controle de throughput.

### 🎬 Session
CRUD completo de sessões. Ao criar uma sessão, os assentos são gerados automaticamente em fileiras de 8 (`A1–A8`, `B1–B8`...). Mínimo de 16 assentos por sessão. `GET /sessions` lista sem assentos; `GET /sessions/:id` inclui assentos completos.

### 💺 Seat
Consulta de disponibilidade em tempo real: cruza o `status` persistido no Postgres com o campo `isLocked` do Redis usando `Promise.all` — todas as verificações de lock acontecem em paralelo.

### 🎟️ Reservation
Reserva com lock atômico Redis (`SET NX EX 30`). Retorna `reservationId` e `expiresAt`. Dois usuários tentando o mesmo assento simultaneamente: um recebe `201`, o outro recebe `409 Conflict` imediatamente.

### 💳 Payment
Módulo orquestrador — não tem tabela própria, coordena as dos outros. Confirma o pagamento dentro de uma **transaction atômica** no Prisma: `Reservation → CONFIRMED` + `Seat → SOLD` + cria `Sale`. Redis e RabbitMQ ficam fora da transaction com `try/catch` próprio — se o `releaseLock` falhar, o TTL resolve; se o `publish` falhar, a DLQ reprocessa.

### 💰 Sale
Histórico de compras por usuário. Query com `include` encadeado: `Sale → Reservation → Seat → Session`, retornando filme, sala, número do assento e preço em uma única chamada ao banco.

### 📡 Events — Publishers e Consumers
Eventos publicados: `reservation.created`, `payment.confirmed`, `reservation.expired`.

O `ReservationConsumer` recebe `reservation.created`, calcula o tempo exato até a expiração e age cirurgicamente — sem varrer o banco inteiro. Usa `ack` em sucesso e `nack` em falha (mensagem vai para DLQ).

### 🪵 Logger
Logger customizado com identidade visual por módulo (badge + cor ANSI), quatro níveis de log (`DEBUG`, `INFO`, `WARN`, `ERROR`) e saída dupla: colorida no terminal para leitura humana e JSON estruturado quando `LOG_JSON=true` — compatível com Datadog, ELK e similares.

O `LoggingInterceptor` captura automaticamente **todas** as requests bem-sucedidas (2xx). O `HttpExceptionFilter` captura **todos** os erros, separando 4xx (`WARN`) de 5xx (`ERROR`). Ambos são registrados globalmente via `APP_INTERCEPTOR` e `APP_FILTER` — nenhum service precisa logar requests manualmente.

---

## 📋 Endpoints da API

| Método | Rota | Descrição | Status |
|---|---|---|---|
| `GET` | `/health` | Health check | `200` |
| `POST` | `/sessions` | Cria sessão + gera assentos automaticamente | `201` |
| `GET` | `/sessions` | Lista todas as sessões | `200` |
| `GET` | `/sessions/:id` | Sessão com assentos incluídos | `200` `404` |
| `GET` | `/seats/:sessionId` | Disponibilidade em tempo real (status + isLocked) | `200` `404` |
| `POST` | `/reservations` | Cria reserva com lock Redis — retorna `expiresAt` | `201` `404` `409` |
| `GET` | `/reservations/:id` | Busca reserva por ID | `200` `404` |
| `GET` | `/reservations/user/:userId` | Histórico de reservas por usuário | `200` |
| `POST` | `/payments/confirm/:reservationId` | Confirma pagamento (transaction atômica) | `201` `404` `409` `410` |
| `GET` | `/sales/history/:userId` | Histórico de vendas por usuário | `200` |

Documentação interativa completa disponível em **http://localhost:3000/api/docs** (Swagger).

---

## 🧪 Exemplo de Fluxo para Testar

### Opção 1 — REST Client (VS Code)

Instale a extensão **REST Client** (`humao.rest-client`) e abra os arquivos na pasta `requests/`:

```
health.http       → verifica se a API está no ar
sessions.http     → cria uma sessão com 20 assentos a R$25,00
seats.http        → consulta disponibilidade (todos AVAILABLE)
reservations.http → reserva o assento A1
                    tente reservar A1 de novo → 409 Conflict (race condition)
payments.http     → confirma o pagamento dentro de 30s
                    tente confirmar de novo → 409 (idempotência)
sales.http        → verifica histórico de vendas do usuário
events.http       → crie uma reserva, aguarde 31s, verifique que virou EXPIRED
```

### Opção 2 — Swagger

Acesse **http://localhost:3000/api/docs** e execute os endpoints diretamente pela interface.

---

## 🧪 Testes Automatizados

```bash
npx jest --verbose
```

**88 testes · 11 suites · 0 falhas · 4.077s**

| Camada | Suites | O que cobre |
|---|---|---|
| `unit/` | 6 | Lógica isolada de cada service e consumer — sem I/O real, dependências mockadas |
| `contract/` | 3 | Shape e status codes dos controllers via HTTP |
| `flow/` | 2 | Fluxos completos: race condition com `Promise.allSettled` e expiração automática com idempotência |

```bash
# Cobertura dos services
npx jest test/unit/ --coverage
```

| Service | Cobertura |
|---|---|
| `session.service` | 100% |
| `seat.service` | 100% |
| `reservation.service` | 100% |
| `payment.service` | 100% |
| `sale.service` | 100% |
| `reservation.consumer` | 94% |

---

## ⚠️ Limitações Conhecidas

- **Autenticação:** o `userId` é uma string livre no body — não há JWT nem sistema de auth implementado. A decisão foi proposital para manter o foco no problema central de concorrência.
- **Rate Limiting:** não implementado nesta versão.
- **Processamento em batch:** o consumer processa mensagens individualmente (`prefetch(1)`). Processamento em lote seria uma melhoria para maior throughput.
- **Testes de integração reais:** os testes de concorrência usam mocks. Testes contra o Redis e RabbitMQ reais exigiriam um ambiente de teste isolado.

---

## 🔮 Melhorias Futuras

- **Autenticação JWT** — extrair `userId` do token em vez do body
- **Rate limiting por IP/usuário** — proteção contra abuso nos endpoints de reserva
- **Testes de integração com Testcontainers** — subir Redis e RabbitMQ reais nos testes
- **Processamento em batch** — agrupar múltiplas confirmações de pagamento em uma única transaction
- **Métricas e observabilidade** — integração com Prometheus/Grafana para monitorar throughput de reservas e taxa de conflitos
- **Cancelamento manual** — endpoint para o usuário cancelar uma reserva `PENDING` antes dos 30s

---

## 🔧 Comandos úteis

```bash
# Rebuild completo do zero
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

# Formatar código
npm run format
```