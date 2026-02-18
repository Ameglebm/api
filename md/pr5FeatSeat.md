# 🎬 PR #5 – Feat-Seat: Disponibilidade de Assentos em Tempo Real
### Controller · Service · Repository · DTO · Interface · Module

Quinta PR do projeto. Com as sessões e assentos criados, era necessário um endpoint dedicado para consulta de disponibilidade em tempo real — cruzando o status persistido no Postgres com os locks ativos no Redis. Essa PR entrega exatamente isso: um snapshot atual de cada assento, mostrando não só o status do banco mas também se há uma reserva em andamento naquele momento.

> ✅ **Testada:** 3 cenários cobertos — happy path + 404 → todos passando

---

# 🧠 1. Decisões Tomadas

### 🏗 Por quê Seat é um módulo separado de Session?

Session gerencia o ciclo de vida de uma sessão — criar, listar, buscar. Seat tem uma responsabilidade diferente: consulta de disponibilidade em tempo real cruzando duas fontes de dados. São responsabilidades distintas que merecem módulos distintos.

### 🔀 Responsabilidades por camada

```
Controller   — recebe sessionId como param, delega pro Service
Service      — valida sessão, busca assentos, cruza com Redis em paralelo
Repository   — busca assentos do Postgres ordenados por seatNumber
Interface    — contrato via ISeatService e ISeatRepository
```

As interfaces garantem que o Controller não sabe se está falando com Prisma ou com um mock. O Service não sabe se o Repository é SQL ou NoSQL.

### ⚡ Por quê Promise.all no cruzamento com Redis?

Sem `Promise.all`, cada assento esperaria o Redis responder antes de ir pro próximo — 20 assentos seriam 20 chamadas sequenciais. Com `Promise.all`, todas as 20 chamadas são disparadas em paralelo e resolvidas juntas. Muito mais eficiente.

### 📊 O que significa cada campo da resposta?

| Campo | Fonte | Significado |
|---|---|---|
| `status` | Postgres | Estado persistido: `AVAILABLE`, `RESERVED`, `SOLD` |
| `isLocked` | Redis | Lock ativo: reserva em andamento nos próximos 30s |

Um assento pode ter `status: AVAILABLE` e `isLocked: true` — significa que alguém está no processo de reserva mas o pagamento ainda não foi confirmado.

### 🔗 Dependência do SessionModule

O `SeatService` valida se a sessão existe antes de buscar os assentos. Para isso injeta o `SessionRepository` — o `SessionModule` precisa exportar `SESSION_REPOSITORY` para que o `SeatModule` consiga injetar.

---

# 📁 2. Arquivos Criados

```
src/models/seat/
├── controller/
│   └── seat.controller.ts
├── dtos/
│   └── response-seat.dto.ts
├── interface/
│   ├── seat.repository.interface.ts
│   └── seat.service.interface.ts
├── repository/
│   └── seat.repository.ts
├── service/
│   └── seat.service.ts
├── seat.constants.ts
└── seat.module.ts
```

---

# 📋 3. Endpoint Implementado

| Método | Rota | Descrição | Status |
|---|---|---|---|
| `GET` | `/seats/:sessionId` | Lista assentos com disponibilidade em tempo real | `200` |

---

# 📝 4. DTO de Resposta

### ResponseSeatDto

| Campo | Tipo | Fonte |
|---|---|---|
| `id` | `string` | Postgres |
| `seatNumber` | `string` | Postgres — ex: `A1`, `B3` |
| `status` | `SeatStatus` | Postgres — `AVAILABLE`, `RESERVED`, `SOLD` |
| `isLocked` | `boolean` | Redis — lock ativo nos próximos 30s |

---

# ⚙️ 5. Interfaces e Tokens

```typescript
// seat.constants.ts
SEAT_REPOSITORY = 'SEAT_REPOSITORY'
SEAT_SERVICE    = 'SEAT_SERVICE'
```

`ISeatRepository` — contrato com `findBySessionId`

`ISeatService` — contrato com `findBySessionId` retornando `ResponseSeatDto[]`

---

# 🔧 6. Módulos Atualizados

### SessionModule — export adicionado

```typescript
exports: [SESSION_SERVICE, SESSION_REPOSITORY]
```

Necessário para que o `SeatService` consiga injetar o `SessionRepository` e validar a sessão.

### AppModule

```typescript
imports: [
  LoggerModule,
  RedisModule,
  RabbitMQModule,
  PrismaModule,
  SessionModule,
  SeatModule, // ← adicionado
]
```

---

# 🧪 7. Testes e Validação

Arquivo: `requests/seats.http`

| # | Cenário | Resultado |
|---|---|---|
| 1 | Criar sessão para teste | ✅ 201 |
| 2 | Listar assentos com isLocked | ✅ 200 — 20 assentos, todos `isLocked: false` |
| 3 | SessionId inexistente | ✅ 404 — "Sessão não encontrada" |

---

# ✅ 8. Checklist

- [x] `GET /seats/:sessionId` retorna assentos com status do Postgres
- [x] `isLocked` cruzado com Redis em `Promise.all` paralelo
- [x] 404 para sessão inexistente
- [x] `SessionModule` exporta `SESSION_REPOSITORY`
- [x] `SeatModule` registrado no `AppModule`
- [x] Todos os 3 cenários de teste passando
---

*PR #5 · @you · status: aguardando revisão*