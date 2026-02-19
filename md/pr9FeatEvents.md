# 🎬 PR #9 – Feat-Events: Consumers e Publishers para Processamento Assíncrono
### Consumers · Publishers · EventsModule

Nona PR do projeto. Fecha o ciclo do sistema de mensageria — até agora o sistema só **publicava** eventos no RabbitMQ, mas ninguém escutava. Agora os consumers processam as mensagens das filas em background, e o mais importante: **a expiração automática de reservas funciona sem intervenção humana**.

> ✅ **Testada:** 7 cenários cobertos — expiração automática + assento liberado + reserva EXPIRED → todos passando

---

# 🧠 1. Decisões Tomadas

### 🔀 Responsabilidades

```
Publishers   — encapsulam a lógica de publicação de eventos
Consumers    — escutam filas e processam mensagens em background
EventsModule — registra tudo e importa dependências necessárias
```

### 📤 Por quê separar Publishers dos Services?

Antes, o `ReservationService` criava a reserva **e** publicava o evento. Muita responsabilidade numa classe só. Agora:

```
ANTES:
  ReservationService → cria reserva + publica evento

DEPOIS:
  ReservationService   → cria reserva
  ReservationPublisher → publica evento
```

Cada classe faz uma coisa — princípio da responsabilidade única (SOLID).

### ⏱️ Como funciona a expiração automática?

O `ReservationConsumer` escuta a fila `reservations`. Quando chega uma mensagem `reservation.created`:

```
1. Calcula quanto tempo falta pra expirar (expiresAt - now)
2. Espera esse tempo (sleep)
3. Busca a reserva no banco
4. Ainda tá PENDING?
   SIM → expira: Reservation→EXPIRED, Seat→AVAILABLE, publica reservation.expired
   NÃO → ignora (já foi confirmada ou já expirou por outro caminho)
```

### 🔄 Por quê usar sleep em vez de scheduler?

Um scheduler (cron job) teria que varrer **todas** as reservas periodicamente procurando expiradas — ineficiente. O consumer já sabe exatamente **qual** reserva vai expirar e **quando**, porque a mensagem carrega o `expiresAt`. Espera o tempo exato e age.

### 🛡️ Proteções do Consumer

```
Reserva não encontrada?     → loga warn, ignora
Reserva já CONFIRMED?       → loga info "já processada", ignora
Reserva já EXPIRED?         → loga info "já processada", ignora
Erro ao processar?          → nack → mensagem vai pra DLQ
```

O consumer nunca quebra — trata todos os cenários e usa `ack`/`nack` corretamente.

### 📋 PaymentConsumer — simples por enquanto

O `PaymentConsumer` escuta a fila `payments` e loga a venda confirmada. Futuramente pode: enviar email de confirmação, gerar nota fiscal, atualizar dashboard de vendas, integrar com sistemas externos.

### 📋 Por quê Events não tem Constants?

Os Publishers e Consumers são classes diretas — sem interface. O NestJS injeta pela classe, não precisa de token.

```
Com interface (ex: ISaleRepository) → precisa de token (SALE_REPOSITORY)
Sem interface (ex: ReservationPublisher) → injeta a classe direto
```

---

# 📁 2. Arquivos Criados

```
src/events/
├── consumers/
│   ├── reservation.consumer.ts    ← escuta fila reservations, expira após 30s
│   └── payment.consumer.ts        ← escuta fila payments, loga venda
├── publishers/
│   ├── reservation.publisher.ts   ← publica reservation.created
│   └── payment.publisher.ts       ← publica payment.confirmed
└── events.module.ts
```

---

# 📋 3. Eventos do Sistema

| Evento | Fila | Publicado por | Consumido por | Ação |
|---|---|---|---|---|
| `reservation.created` | `reservations` | ReservationPublisher | ReservationConsumer | Agenda expiração após 30s |
| `payment.confirmed` | `payments` | PaymentPublisher | PaymentConsumer | Loga venda (futuro: email, NF) |
| `reservation.expired` | `expirations` | ReservationConsumer | — (futuro) | Registra expiração |

---

# ⚙️ 4. Interfaces Tipadas para Eventos

```typescript
// ReservationCreatedEvent
{
  event: 'reservation.created',
  reservationId: string,
  seatId: string,
  userId: string,
  expiresAt: string
}

// PaymentConfirmedEvent
{
  event: 'payment.confirmed',
  data: {
    saleId: string,
    seatId: string,
    userId: string,
    reservationId: string
  }
}
```

---

# 🔧 5. Módulos Atualizados

### EventsModule

```typescript
imports: [RabbitMQModule, ReservationModule, SeatModule]
providers: [ReservationPublisher, PaymentPublisher, ReservationConsumer, PaymentConsumer]
exports: [ReservationPublisher, PaymentPublisher]
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
  PaymentModule,
  SaleModule,
  EventsModule, // ← adicionado
]
```

---

# 🧪 6. Testes e Validação

Arquivo: `requests/events.http`

| # | Cenário | Resultado |
|---|---|---|
| 1 | Criar sessão para setup | ✅ 201 |
| 2 | Listar assentos — todos AVAILABLE | ✅ 200 |
| 3 | Criar reserva | ✅ 201 — PENDING |
| 4 | Verificar assento lockado | ✅ 200 — A1 `isLocked: true` |
| 5 | Esperar 31 segundos | ⏳ |
| 6 | Assento voltou AVAILABLE automaticamente | ✅ **200** — A1 `isLocked: false` (consumer agiu) |
| 7 | Reserva ficou EXPIRED | ✅ **200** — `status: EXPIRED` |

### Logs confirmam expiração automática

```
[ReservationConsumer] Evento recebido: reservation.created
[ReservationConsumer] Reserva expirada automaticamente
  → reservationId: 78405c7f-...
  → seatId: 80ed9aba-...
[RabbitMQService] Evento publicado em [expirations]
  → event: reservation.expired
```

---

# ✅ 7. Checklist

- [x] `ReservationConsumer` escuta fila `reservations` e expira reservas após 30s
- [x] `PaymentConsumer` escuta fila `payments` e processa vendas confirmadas
- [x] `ReservationPublisher` encapsula publicação de `reservation.created`
- [x] `PaymentPublisher` encapsula publicação de `payment.confirmed`
- [x] Expiração automática: Reservation→EXPIRED + Seat→AVAILABLE sem intervenção
- [x] Evento `reservation.expired` publicado na fila `expirations`
- [x] Proteções: reserva não encontrada, já confirmada, já expirada — todos tratados
- [x] `ack` em sucesso, `nack` em falha → DLQ recebe mensagens com erro
- [x] `EventsModule` registrado no `AppModule`
- [x] Todos os 7 cenários de teste passando
---

*PR #9 · @you · status: aguardando revisão*