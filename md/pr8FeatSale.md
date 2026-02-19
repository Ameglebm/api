# 🎬 PR #8 – Feat-Sale: Histórico de Vendas por Usuário
### Controller · Service · Repository · DTOs · Interface · Module

Oitava PR do projeto. Módulo mais simples do sistema — apenas leitura. Retorna o histórico completo de compras confirmadas de um usuário, com dados encadeados da sessão original (filme, sala, assento, preço). Usa `include` do Prisma para trazer tudo numa query só.

> ✅ **Testada:** 9 cenários cobertos — happy path + array vazio + múltiplas vendas → todos passando

---

# 🧠 1. Decisões Tomadas

### 🔀 Responsabilidades por camada

```
Controller   — recebe :userId via param, delega pro Service
Service      — chama Repository, mapeia para ResponseSaleDto
Repository   — query Prisma com include encadeado
Interface    — contrato via ISaleService e ISaleRepository
```

### 🔗 Por quê include encadeado?

O histórico precisa mostrar não só a venda, mas **onde** e **o quê** o usuário comprou. Sem o `include`, a Sale só tem IDs. Com o include, uma única query traz tudo:

```
Sale → Reservation → Seat → Session
                      ↓        ↓
                  seatNumber  movie, room, ticketPrice, startsAt
```

Resultado: o frontend recebe dados completos sem precisar fazer múltiplas chamadas.

### 📋 SaleWithDetails — tipagem customizada

O tipo `Sale` do Prisma não conhece as relações. Para o TypeScript saber que `sale.reservation.seat.session` existe, foi criado um tipo customizado:

```typescript
export type SaleWithDetails = Sale & {
  reservation: Reservation & {
    seat: Seat & {
      session: Session;
    };
  };
};
```

Sem isso, o Service daria erro de compilação ao acessar `sale.reservation.seat.seatNumber`.

### 📋 Por quê não tem DTO de entrada?

O endpoint é `GET /sales/history/:userId` — o `userId` vem da URL via `@Param`. Não existe body, então não existe DTO de entrada.

### 📋 Por quê não tem create/update?

Sale é criada pelo `PaymentService` dentro da transaction atômica (PR #7). Nunca é editada ou deletada. O módulo Sale é **apenas consulta**.

---

# 📁 2. Arquivos Criados

```
src/models/sale/
├── controller/
│   └── sale.controller.ts
├── dtos/
│   └── response-sale.dto.ts
├── interface/
│   ├── sale.repository.interface.ts
│   └── sale.service.interface.ts
├── repository/
│   └── sale.repository.ts
├── service/
│   └── sale.service.ts
├── sale.constants.ts
└── sale.module.ts
```
---

# 📋 3. Endpoint Implementado

| Método | Rota | Descrição | Status |
|---|---|---|---|
| `GET` | `/sales/history/:userId` | Histórico de compras confirmadas do usuário | `200` |

---

# 📝 4. DTOs

### ResponseSaleDto

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `string` | ID da Sale |
| `reservationId` | `string` | Reserva de origem |
| `seatId` | `string` | Assento comprado |
| `userId` | `string` | Comprador |
| `paidAt` | `Date` | Momento do pagamento |
| `seatNumber` | `string` | Ex: `A1`, `B3` |
| `movie` | `string` | Nome do filme |
| `room` | `string` | Nome da sala |
| `startsAt` | `Date` | Horário da sessão |
| `ticketPrice` | `number` | Preço do ingresso |

---

# ⚙️ 5. Interfaces e Tokens

```typescript
// sale.constants.ts
SALE_REPOSITORY = 'SALE_REPOSITORY'
SALE_SERVICE    = 'SALE_SERVICE'
```

`ISaleRepository` — `findByUserId(userId: string): Promise<SaleWithDetails[]>`

`ISaleService` — `findByUserId(userId: string): Promise<ResponseSaleDto[]>`

---

# 🔧 6. Módulos Atualizados

### SaleModule

```typescript
imports: [PrismaModule]
exports: [SALE_REPOSITORY, SALE_SERVICE]
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
  SaleModule, // ← adicionado
]
```

---

# 🧪 7. Testes e Validação

Arquivo: `requests/sales.http`

| # | Cenário | Resultado |
|---|---|---|
| 1 | Criar sessão para setup | ✅ 201 |
| 2 | Listar assentos | ✅ 200 — todos AVAILABLE |
| 3 | Criar reserva | ✅ 201 — PENDING |
| 4 | Confirmar pagamento | ✅ 201 — Sale criada |
| 5 | Histórico do usuário | ✅ **200** — array com movie, room, seatNumber, ticketPrice |
| 6 | Usuário sem compras | ✅ **200** — `[]` array vazio |
| 7 | Segunda reserva (outro assento) | ✅ 201 — PENDING |
| 8 | Confirmar segunda compra | ✅ 201 — Sale criada |
| 9 | Histórico com 2 vendas | ✅ **200** — mais recente primeiro (`paidAt desc`) |

---

# ✅ 8. Checklist

- [x] `GET /sales/history/:userId` retorna histórico completo
- [x] Include encadeado: Sale → Reservation → Seat → Session
- [x] `SaleWithDetails` type para tipar relações do Prisma
- [x] `ResponseSaleDto` com movie, room, seatNumber, ticketPrice
- [x] Ordenação por `paidAt desc` — mais recente primeiro
- [x] Array vazio para usuário sem compras (sem erro)
- [x] `create-sale.dto.ts` e `update-sale.dto.ts` removidos
- [x] `SaleModule` registrado no `AppModule`
- [x] Todos os 9 cenários de teste passando
---

*PR #8 · @you · status: aguardando revisão*