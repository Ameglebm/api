# 🎬 PR #6 – Feat-Reservation: Reserva com Lock Redis + Publicação RabbitMQ
### Controller · Service · Repository · DTOs · Interface · Module

Sexta PR do projeto. Esta é a PR mais importante do sistema — aqui está o coração da solução para o problema central do desafio: garantir que nenhum assento seja vendido duas vezes, mesmo com múltiplos usuários tentando no mesmo momento. O controle de concorrência é implementado com lock atômico no Redis usando `SET NX EX`.

> ✅ **Testada:** 8 cenários cobertos — happy path + race condition + validações → todos passando

---

# 🧠 1. Decisões Tomadas

### 🔀 Responsabilidades por camada

```
Controller   — valida entrada via DTO, delega pro Service
Service      — adquire lock Redis, cria reserva, publica evento RabbitMQ
Repository   — persiste via Prisma, busca por ID e por usuário, expira reserva
Interface    — contrato via IReservationService e IReservationRepository
```

### ⚛️ Por quê SET NX EX no Redis?

`SET NX` — só seta se a chave NÃO existe. Operação atômica no Redis — não existe race condition entre verificar e setar. Dois usuários chegando ao mesmo millisegundo: um consegue o lock, o outro recebe 409.

```
Usuario A → acquireLock(seatId) → OK   → cria reserva → 201
Usuario B → acquireLock(seatId) → FAIL → 409 Conflict
```

### ⏱️ TTL de 30 segundos

O lock expira automaticamente após 30s — se o pagamento não for confirmado, o assento volta a estar disponível para outros usuários. Sem necessidade de job scheduler para limpar.

### 📤 Por quê publicar no RabbitMQ após criar a reserva?
(OBS: é somente um exemplo okay)

Desacoplamento. O consumer da fila `reservations` pode:
- Enviar email de confirmação
- Acionar o timer de expiração
- Integrar com sistemas externos

O Service não conhece quem vai consumir — só publica e segue

### 🔗 Dependência do SeatModule

O `ReservationService` injeta o `SeatRepository` para validar se o assento existe antes de tentar o lock. Isso evita criar locks no Redis para assentos que não existem.

### 👤 userId sem autenticação

O sistema ainda não tem auth — o `userId` é uma string livre no body. O `IsUUID` foi removido do `userId` propositalmente. Quando auth for implementado o DTO será atualizado para pegar o userId do token JWT.

---

# 📁 2. Arquivos Criados

```
src/models/reservation/
├── controller/
│   └── reservation.controller.ts
├── dtos/
│   ├── create-reservation.dto.ts
│   └── response-reservation.dto.ts
├── interface/
│   ├── reservation.repository.interface.ts
│   └── reservation.service.interface.ts
├── repository/
│   └── reservation.repository.ts
├── service/
│   └── reservation.service.ts
├── reservation.constants.ts
└── reservation.module.ts
```

### Arquivos atualizados em outros módulos

```
src/models/seat/
├── interface/
│   └── seat.repository.interface.ts  ← adicionado findById
└── repository/
    └── seat.repository.ts            ← adicionado findById
```

---

# 📋 3. Endpoints Implementados

| Método | Rota | Descrição | Status |
|---|---|---|---|
| `POST` | `/reservations` | Cria reserva com lock Redis 30s | `201` |
| `GET` | `/reservations/:id` | Busca reserva por ID | `200` |
| `GET` | `/reservations/user/:userId` | Histórico de reservas do usuário | `200` |

---

# 📝 4. DTOs e Validações

### CreateReservationDto

| Campo | Tipo | Validação |
|---|---|---|
| `seatId` | `string` | UUID v4 válido |
| `userId` | `string` | não vazio |

### ResponseReservationDto

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `string` | ID da reserva |
| `seatId` | `string` | ID do assento reservado |
| `userId` | `string` | ID do usuário |
| `status` | `ReservationStatus` | `PENDING`, `CONFIRMED`, `EXPIRED` |
| `expiresAt` | `Date` | Timestamp de expiração — now + 30s |
| `createdAt` | `Date` | Timestamp de criação |

---

# ⚙️ 5. Interfaces e Tokens

```typescript
// reservation.constants.ts
RESERVATION_REPOSITORY = 'RESERVATION_REPOSITORY'
RESERVATION_SERVICE    = 'RESERVATION_SERVICE'
```

`IReservationRepository` — `create`, `findById`, `findByUserId`, `expire`

`IReservationService` — `create`, `findById`, `findByUserId`

O `expire` não está no Service Interface — será chamado pelo consumer do RabbitMQ quando a fila `expirations` processar a mensagem.

---

# 🔧 6. AppModule Atualizado

```typescript
imports: [
  LoggerModule,
  RedisModule,
  RabbitMQModule,
  PrismaModule,
  SessionModule,
  SeatModule,
  ReservationModule, // ← adicionado
]
```

---

# 🧪 7. Testes e Validação

Arquivo: `requests/reservations.http`

| # | Cenário | Resultado |
|---|---|---|
| 1 | Criar sessão para setup | ✅ 201 |
| 2 | Listar assentos | ✅ 200 |
| 3 | Criar reserva | ✅ 201 — `status: PENDING`, `expiresAt: now+30s` |
| 4 | Buscar por ID | ✅ 200 |
| 5 | Histórico por usuário | ✅ 200 |
| 6 | Race condition — mesmo assento em < 30s | ✅ **409** "Assento já está sendo reservado" |
| 7 | Assento inexistente | ✅ 404 |
| 8 | Campo inválido | ✅ 400 |

---

# ✅ 8. Checklist

- [x] `POST /reservations` cria reserva com lock atômico Redis `SET NX EX 30`
- [x] 409 quando assento já está lockado — race condition tratado
- [x] `expiresAt` calculado como `now + 30s`
- [x] Evento `reservation.created` publicado no RabbitMQ
- [x] `GET /reservations/:id` busca por ID com 404
- [x] `GET /reservations/user/:userId` histórico do usuário
- [x] `SeatRepository.findById` adicionado para validar assento antes do lock
- [x] `ReservationModule` registrado no `AppModule`
- [x] Todos os 8 cenários de teste passando
---

*PR #6 · @you · status: aguardando revisão*