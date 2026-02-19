# 🧪 PR #12 – Tests: Cobertura Completa — Unit, Contract e Flow
### 88 testes · 11 suites · 100% nos services · 0 falhas

Décima segunda PR do projeto. Implementa a suite de testes completa — unitários, de contrato e de fluxo — cobrindo todos os services, consumers e controllers da aplicação.

> ✅ **Resultado final:** 88/88 testes passando em 4.077s

---

# 🧠 1. Decisões Tomadas

### Por quê três camadas de teste?

Cada camada testa uma coisa diferente e se complementam:

```
unit/      → lógica isolada de cada service (sem I/O real)
contract/  → shape e status codes dos controllers (HTTP)
flow/      → fluxos completos e casos de borda entre services
```

Testar só unitário não garante que o controller retorna o status certo. Testar só contrato não garante que a lógica de negócio está correta. As três camadas juntas dão confiança real.

### Por quê mockar tudo nos unit tests?

Os services dependem de Redis, RabbitMQ, Prisma e outros services — se testássemos com as implementações reais, um teste de `PaymentService` quebraria se o Redis estivesse offline. Com mocks:

- Testes rodam sem nenhum serviço externo
- Cada teste controla exatamente o que o mock retorna
- Falhas são isoladas — você sabe exatamente o que quebrou

### Por quê `capturedHandler` nos flow tests?

O `ReservationConsumer` registra um callback no RabbitMQ via `consume()`. Para testar o handler sem subir o RabbitMQ real e sem `setTimeout` real, capturamos o callback no momento do registro:

```typescript
const mockRabbitMQ = {
  consume: jest.fn().mockImplementation(async (_queue, handler) => {
    capturedHandler = handler; // captura aqui
  }),
};

// no teste — chama direto, sem esperar timer real
await capturedHandler(mockPayload);
```

Isso elimina flakiness por timing e mantém os testes determinísticos.

### Por quê `Promise.allSettled` no teste de race condition?

```typescript
const [result1, result2] = await Promise.allSettled([
  reservationService.create({ seatId: 'seat-001', userId: 'usuario-001' }),
  reservationService.create({ seatId: 'seat-001', userId: 'usuario-002' }),
]);

expect(result1.status).toBe('fulfilled');
expect(result2.status).toBe('rejected');
```

`Promise.all` quebraria o teste se qualquer promise rejeitasse. `Promise.allSettled` deixa ambas resolverem e permite verificar qual passou e qual foi bloqueada — que é exatamente o comportamento esperado na race condition.

---

# 🔧 2. Correção Aplicada

### `ParseUUIDPipe` retornava 400 em vez de 422

O teste de contrato esperava `422 Unprocessable Entity` para UUID inválido, mas o `ParseUUIDPipe` do NestJS lança `400 Bad Request` por padrão.

**Correção no `payment.controller.ts`:**

```typescript
// antes
@Param('reservationId', ParseUUIDPipe) reservationId: string,

// depois — 422 é semanticamente mais preciso para formato inválido
@Param('reservationId', new ParseUUIDPipe({ errorHttpStatusCode: 422 })) reservationId: string,
```

`422 Unprocessable Entity` é mais correto que `400 Bad Request` para este caso — a requisição foi recebida e entendida, mas o dado tem formato inválido.

---

# 📁 3. Estrutura dos Testes

```
test/
├── unit/
│   ├── session.service.spec.ts         ← 8 testes
│   ├── seat.service.spec.ts            ← 6 testes
│   ├── reservation.service.spec.ts     ← 12 testes
│   ├── reservation.consumer.spec.ts    ← 8 testes
│   ├── payment.service.spec.ts         ← 13 testes
│   └── sale.service.spec.ts            ← 6 testes
├── contract/
│   ├── session.contract.spec.ts        ← 7 testes
│   ├── reservation.contract.spec.ts    ← 7 testes
│   └── payment.contract.spec.ts        ← 6 testes
└── flow/
    ├── reservation-payment.flow.spec.ts ← 7 testes
    └── expiration.flow.spec.ts          ← 8 testes
```

---

# 📋 4. O que cada suite cobre

### Unit — `session.service.spec.ts` (8 testes)
```
create    → cria sessão, gera assentos A1-A8/B1-B8, chama repository
findAll   → retorna array, retorna vazio
findById  → encontrado, NotFoundException, chama com id correto
```

### Unit — `seat.service.spec.ts` (6 testes)
```
findBySessionId → isLocked false/true, chama redis por assento,
                  NotFoundException, não chama repo se sessão inexiste,
                  array vazio sem assentos
```

### Unit — `reservation.service.spec.ts` (12 testes)
```
create    → sucesso, adquire lock Redis, publica evento,
            NotFoundException assento inexiste, não tenta lock,
            ConflictException lock falha, não cria no banco, não publica
findById  → encontrado, NotFoundException
findByUserId → retorna lista, retorna vazio
```

### Unit — `reservation.consumer.spec.ts` (8 testes)
```
onModuleInit         → registra na fila reservations
handler PENDING      → expira reserva, libera assento, publica expired, loga
handler CONFIRMED    → ignora, loga "já processada"
handler não encontrada → não quebra, loga warn
```

### Unit — `payment.service.spec.ts` (13 testes)
```
validações  → 404 reserva inexiste (não inicia tx), 409 já confirmada,
              410 expirada (loga warn), 409 assento SOLD
sucesso     → retorna Sale, 3 operações atômicas na tx,
              libera lock Redis, publica payment.confirmed, loga
resiliência → não quebra se Redis falhar, não quebra se RabbitMQ falhar
```

### Unit — `sale.service.spec.ts` (6 testes)
```
findByUserId → dados completos, array vazio, múltiplas vendas,
               converte ticketPrice para number, loga, chama com userId
```

### Contract — `session.contract.spec.ts` (7 testes)
```
POST /sessions     → 201 shape correto, seats shape correto, chama service
GET /sessions      → 200 array, 200 array vazio
GET /sessions/:id  → 200 encontrado, 404 não encontrado
```

### Contract — `reservation.contract.spec.ts` (7 testes)
```
POST /reservations           → 201 shape, 404 assento, 409 conflito
GET /reservations/:id        → 200 encontrado, 404 não encontrado
GET /reservations/user/:userId → 200 com reservas, 200 array vazio
```

### Contract — `payment.contract.spec.ts` (6 testes)
```
POST /payments/confirm/:id → 201 shape, chama service com reservationId,
                             404, 409, 410, 422 UUID inválido
```

### Flow — `reservation-payment.flow.spec.ts` (7 testes)
```
sucesso          → reserva → pagamento em sequência, lock adquirido/liberado,
                   eventos publicados na ordem certa
race condition   → segundo usuário bloqueado, Promise.allSettled garante 1 reserva
assento inexiste → NotFoundException, não adquire lock
```

### Flow — `expiration.flow.spec.ts` (8 testes)
```
expiração        → expira PENDING, libera AVAILABLE, publica reservation.expired
idempotência     → CONFIRMED não reprocessado, EXPIRED não reprocessado,
                   não publica se já CONFIRMED
não encontrada   → não quebra, loga warn
```

---

# 📊 5. Cobertura

```
npx jest test/unit/ --coverage
```

| Service | Statements | Lines |
|---|---|---|
| `payment.service.ts` | 100% | 100% |
| `reservation.service.ts` | 100% | 100% |
| `sale.service.ts` | 100% | 100% |
| `seat.service.ts` | 100% | 100% |
| `session.service.ts` | 100% | 100% |
| `reservation.consumer.ts` | 94% | 96% |

> O coverage geral do projeto aparece como 41% porque o Jest conta todos os arquivos — modules, controllers, repositories, DTOs. Isso é esperado e normal. O desafio pede 60-70% nos services — foi entregue 100%.

---

# 🏁 6. Resultado Final

```
npx jest --verbose

Test Suites: 11 passed, 11 total
Tests:       88 passed, 88 total
Snapshots:   0 total
Time:        4.077s
```

---

# ✅ 7. Checklist

- [x] `session.service.spec.ts` — 8 testes, 100% cobertura
- [x] `seat.service.spec.ts` — 6 testes, 100% cobertura
- [x] `reservation.service.spec.ts` — 12 testes, 100% cobertura
- [x] `reservation.consumer.spec.ts` — 8 testes, 94% cobertura
- [x] `payment.service.spec.ts` — 13 testes, 100% cobertura
- [x] `sale.service.spec.ts` — 6 testes, 100% cobertura
- [x] `session.contract.spec.ts` — 7 testes
- [x] `reservation.contract.spec.ts` — 7 testes
- [x] `payment.contract.spec.ts` — 6 testes
- [x] `reservation-payment.flow.spec.ts` — 7 testes (race condition coberta)
- [x] `expiration.flow.spec.ts` — 8 testes (idempotência coberta)
- [x] `ParseUUIDPipe` corrigido para retornar 422 em vez de 400
- [x] 88/88 testes passando, 0 falhas

---

*PR #12 · @you · status: aguardando revisão*