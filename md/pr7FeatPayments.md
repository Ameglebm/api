# 🎬 PR #7 – Feat-Payment: Confirmação de Pagamento com Transaction Atômica
### Controller · Service · DTOs · Interface · Module

Sétima PR do projeto. Este é o módulo orquestrador — ele junta tudo que foi construído até agora: valida a reserva, confirma o pagamento dentro da janela de 30s, persiste a venda, atualiza o assento, libera o lock e publica o evento. Tudo dentro de uma transaction atômica no Prisma que garante consistência: se qualquer etapa falhar, o banco volta ao estado anterior.

> ✅ **Testada:** 8 cenários cobertos — happy path + expiração + duplicidade + 404 → todos passando

---

# 🧠 1. Decisões Tomadas

### 🔀 Responsabilidades por camada

```
Controller   — recebe :reservationId via param, delega pro Service
Service      — valida reserva, orquestra transaction, libera Redis, publica RabbitMQ
Interface    — contrato via IPaymentService
(sem Repository — Payment não tem tabela própria, orquestra as dos outros)
```

### 🔒 Por quê transaction atômica?

O pagamento faz 3 escritas no banco: Reservation→CONFIRMED, Seat→SOLD, cria Sale. Se qualquer uma falhar, as outras precisam ser desfeitas — senão o banco fica inconsistente (ex: assento vendido sem registro de venda). A `prisma.$transaction` garante tudo ou nada.

```
tx.reservation.update → CONFIRMED    ─┐
tx.seat.update        → SOLD         ─┤ mesmo pacote
tx.sale.create        → registro     ─┘
                                       ↓
                              erro em qualquer um?
                              → desfaz TUDO automaticamente
```

### 📤 Por quê Redis e RabbitMQ ficam FORA da transaction?

A transaction protege só o banco. Redis e RabbitMQ são side effects — se falharem, não causam inconsistência:

- **Redis** — se o `releaseLock` falhar, o TTL de 30s libera sozinho
- **RabbitMQ** — se o `publish` falhar, a venda já está persistida e a DLQ pode reprocessar

Por isso ambos ficam após o commit da transaction, dentro de `try/catch` próprio.

### 🛡 Defesa em profundidade — 4 validações antes da transaction

```
1. Reservation existe?        → 404 Not Found
2. Status === PENDING?         → 409 Conflict (já confirmada)
3. expiresAt > now()?          → 410 Gone (expirou)
4. Seat.status !== SOLD?       → 409 Conflict (vendido por outro caminho)
```

A validação 4 é uma camada extra de segurança: se o Redis tiver falhado e dois processos chegarem ao pagamento, o check no banco impede a duplicação.

### 📋 Por quê não tem Repository?

Payment não tem tabela própria — ele orquestra tabelas dos outros módulos. Os repositories de Reservation e Seat são usados para as **leituras** (validações). As **escritas** usam `tx` direto dentro da transaction, porque precisam compartilhar o mesmo pacote atômico.

### 📋 Por quê não tem DTO de entrada?

O endpoint é `POST /payments/confirm/:reservationId` — o `reservationId` vem da URL via `@Param`. O `userId` já está dentro da Reservation no banco. Não existe body, então não existe DTO de entrada.

---

# 📁 2. Arquivos Criados

```
src/models/payment/
├── controller/
│   └── payment.controller.ts
├── dtos/
│   └── response-payment.dto.ts
├── interface/
│   └── payment.service.interface.ts
├── service/
│   └── payment.service.ts
├── payment.constants.ts
└── payment.module.ts
```
---

# 📋 3. Endpoint Implementado

| Método | Rota | Descrição | Status |
|---|---|---|---|
| `POST` | `/payments/confirm/:reservationId` | Confirma pagamento e converte reserva em venda | `201` `404` `409` `410` |

---

# 📝 4. DTOs

### ResponsePaymentDto

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `string` | ID da Sale criada |
| `reservationId` | `string` | Reserva de origem |
| `seatId` | `string` | Assento vendido |
| `userId` | `string` | Comprador |
| `paidAt` | `Date` | Momento da confirmação |

---

# ⚙️ 5. Interface e Token

```typescript
// payment.constants.ts
PAYMENT_SERVICE = 'PAYMENT_SERVICE'
// sem PAYMENT_REPOSITORY — Payment não tem tabela própria
```

`IPaymentService` — `confirm(reservationId: string): Promise<Sale>`

---

# 🔧 6. Módulos Atualizados

### PaymentModule

```typescript
imports: [ReservationModule, SeatModule]
// injeta RESERVATION_REPOSITORY e SEAT_REPOSITORY dos outros módulos
```

### AppModule

```typescript
imports: [
  LoggerModule,
  RedisModule,
  RabbitMQModule,
  PrismaModule,
  SessionModule,
  SeatModule,
  ReservationModule,
  PaymentModule, // ← adicionado
]
```

---

# 🧪 7. Testes e Validação

Arquivo: `requests/payments.http`

| # | Cenário | Resultado |
|---|---|---|
| 1 | Criar sessão para setup | ✅ 201 |
| 2 | Listar assentos | ✅ 200 — todos AVAILABLE |
| 3 | Criar reserva | ✅ 201 — PENDING, expiresAt +30s |
| 4 | Confirmar pagamento dentro de 30s | ✅ **201** — Sale criada |
| 5 | Verificar assento virou SOLD | ✅ 200 — A1 `SOLD`, `isLocked: false` |
| 6 | Confirmar mesma reserva de novo | ✅ **409** "Reserva já foi confirmada" |
| 7 | ReservationId inexistente | ✅ **404** "Reserva não encontrada" |
| 8 | Confirmar reserva expirada (31s+) | ✅ **410** "Reserva expirada" |

---

# ✅ 8. Checklist

- [x] `POST /payments/confirm/:reservationId` com `ParseUUIDPipe`
- [x] 4 validações antes da transaction: existe, PENDING, não expirou, seat não SOLD
- [x] Transaction atômica: Reservation→CONFIRMED + Seat→SOLD + cria Sale
- [x] `redis.releaseLock` fora da transaction com try/catch
- [x] `rabbitmq.publish('payment.confirmed')` fora da transaction com try/catch
- [x] `ResponsePaymentDto` serializa a Sale criada
- [x] `PaymentModule` importa `ReservationModule` e `SeatModule`
- [x] `PaymentModule` registrado no `AppModule`
- [x] Todos os 8 cenários de teste passando
---

*PR #7 · @you · status: aguardando revisão*