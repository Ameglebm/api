# 🪵 PR #10 – Feat-Logging: Logger Estruturado, Interceptor Global e Filter de Exceções
### LoggerService · LoggingInterceptor · HttpExceptionFilter · Temas Visuais por Contexto

Décima PR do projeto. Implementa o sistema de logging estruturado completo — desde o `LoggerService` com identidade visual por módulo até o interceptor e filter globais que capturam **todas** as requisições e erros automaticamente, sem precisar logar manualmente em cada service.

> ✅ **Testada:** todos os endpoints cobertos — sessões, assentos, reservas, pagamentos, vendas, erros 4xx/5xx

---

# 🧠 1. Decisões Tomadas

### 📋 Por quê um LoggerService customizado e não o padrão do NestJS?

O logger padrão do NestJS não tem cor, não tem contexto visual e não diferencia módulos. O customizado entrega:

```
ANTES (padrão NestJS):
  [Nest] LOG [RabbitMQService] Fila declarada: reservations

DEPOIS (customizado):
  09:21:58 ✓ INFO  🐇 [RabbitMQService] Fila declarada: reservations
```

Cada módulo tem **badge + cor própria** — em 1 segundo você sabe de onde veio o log sem ler o nome.

### 🌐 Por quê Interceptor + Filter globais em vez de logar em cada service?

Sem global, cada service precisaria de `logger.log(...)` em todos os métodos — acoplamento alto e código repetido. Com global:

```
LoggingInterceptor  → captura TODAS as requests com sucesso (2xx) automaticamente
HttpExceptionFilter → captura TODOS os erros (4xx, 5xx) automaticamente
```

Um único lugar para mudar o formato de log de toda a aplicação.

### 📍 Por quê registrar no `app.module.ts` e não no `main.ts`?

No `main.ts` seria necessário instanciar manualmente fora do container do NestJS — sem injeção de dependência. No `app.module.ts` o próprio container resolve tudo:

```typescript
// main.ts — ruim, instancia fora do DI container
app.useGlobalFilters(new HttpExceptionFilter()); // logger undefined!

// app.module.ts — correto, DI resolve automaticamente
{ provide: APP_FILTER, useClass: HttpExceptionFilter }
```

### 🎨 Por quê cores diferentes por nível de log?

Padrão da indústria — os olhos identificam antes do cérebro ler:

```
✓ INFO   → verde brilhante  — fluxo normal
⚠ WARN   → amarelo          — erro do cliente (4xx), situação anômala esperada
✖ ERROR  → vermelho         — erro do servidor (5xx), algo quebrou
· DEBUG  → dim              — diagnóstico, não polui em produção
```

### 🔤 Por quê colorir os verbos HTTP igual Postman/Insomnia?

```
GET    → verde    — leitura, seguro
POST   → amarelo  — criação
PUT    → azul     — substituição
PATCH  → magenta  — atualização parcial
DELETE → vermelho — destrutivo
```

Padrão visual já conhecido por qualquer desenvolvedor — zero curva de aprendizado.

---

# 📁 2. Arquivos Criados/Modificados

```
src/common/
├── logger/
│   └── logger.service.ts         ← reescrito — temas visuais, cores ANSI, verbos HTTP
├── interceptors/
│   └── logging.interceptor.ts    ← novo — captura todas as requests 2xx
└── filters/
    └── http-exception.filter.ts  ← atualizado — injeta logger, captura todos os erros
```

---

# 🎨 3. Identidade Visual por Contexto

| Contexto | Badge | Cor |
|---|---|---|
| `RedisService` | 🟢 | verde brilhante |
| `RabbitMQService` | 🐇 | magenta |
| `PrismaService` | 🗄️ | azul brilhante |
| `SessionService/Repo` | 🎬 | verde |
| `SeatService/Repo` | 🪑 | cyan |
| `ReservationService/Repo` | 🗒️ | magenta brilhante |
| `PaymentService` | 💳 | amarelo |
| `SaleService/Repo` | 💰 | verde brilhante |
| `ReservationPublisher` | 🗒️ 📡 | magenta brilhante |
| `ReservationConsumer` | 🗒️ 📻 | magenta brilhante |
| `PaymentPublisher` | 💳 📡 | amarelo brilhante |
| `PaymentConsumer` | 💳 📻 | amarelo brilhante |
| `HTTP` | 🌐 | cyan brilhante |
| `HttpExceptionFilter` | 🌐 | amarelo brilhante |

> 📡 publisher (emite) · 📻 consumer (recebe) — diferenciação visual imediata

---

# ⚙️ 4. Comportamento do LoggingInterceptor

Enxuto por decisão — só loga o essencial:

```typescript
// Array (listagens) → só total
GET /sessions        → { statusCode: 200, ms: "8ms", total: 3 }

// Objeto com id (criações) → só id
POST /sessions       → { statusCode: 201, ms: "89ms", id: "db11ea..." }

// Sem id (health, etc) → só status e tempo
GET /health          → { statusCode: 200, ms: "2ms" }
```

Sem body gigante no terminal — `POST /sessions` com 20 assentos não despeja o JSON inteiro.

---

# 🛡️ 5. Comportamento do HttpExceptionFilter

```
4xx → ⚠ WARN  — erro do cliente, situação esperada
5xx → ✖ ERROR — erro do servidor, investigar

POST /reservations → 409
  ⚠ WARN  🌐 [HttpExceptionFilter]  POST /reservations → 409
           { "message": "Assento já está sendo reservado", "statusCode": 409 }

GET /sessions/id-invalido → 404
  ⚠ WARN  🌐 [HttpExceptionFilter]  GET /sessions/id-invalido → 404
           { "message": "Sessão não encontrada", "statusCode": 404 }
```

---

# 📋 6. Logs Adicionados por Service

### SessionService
```
✓ Sessão criada         → { sessionId, movie, room, totalSeats }
✓ Sessões listadas      → { total }
✓ Sessão encontrada     → { sessionId, movie }
⚠ Sessão não encontrada → { sessionId }
```

### SeatService
```
✓ Assentos listados     → { sessionId, total, available, locked, sold }
⚠ Sessão não encontrada → { sessionId }
```

### ReservationService
```
✓ Reserva criada                    → { reservationId, seatId, userId, expiresAt }
✓ Reserva encontrada                → { reservationId, status, userId }
✓ Reservas listadas por usuário     → { userId, total }
⚠ Conflito — assento já reservado   → { seatId, userId }
⚠ Reserva não encontrada            → { reservationId }
```

### PaymentService
```
✓ Pagamento confirmado com sucesso  → { saleId, reservationId, seatId, userId }
⚠ Reserva não encontrada           → { reservationId }
⚠ Reserva já confirmada            → { reservationId, status }
⚠ Tentativa de confirmar expirada  → { reservationId, expiresAt }
⚠ Assento já vendido               → { reservationId, seatId }
⚠ Falha ao remover lock Redis      → { seatId }
⚠ Falha ao publicar evento         → { saleId }
```

### PrismaService
```
✓ Conectado ao PostgreSQL
✓ Desconectado do PostgreSQL
```

---

# 🧪 7. Validação

Todos os endpoints cobertos após os ajustes:

| Endpoint | Antes | Depois |
|---|---|---|
| `POST /sessions` | ❌ sem log | ✅ loga criação |
| `GET /sessions` | ❌ sem log | ✅ loga total |
| `GET /sessions/:id` | ❌ sem log | ✅ loga encontrado/não encontrado |
| `GET /seats/:sessionId` | ❌ sem log | ✅ loga available/locked/sold |
| `POST /reservations` | ❌ sem log | ✅ loga criação e conflitos |
| `GET /reservations/:id` | ❌ sem log | ✅ loga encontrado/não encontrado |
| `GET /reservations/user/:userId` | ❌ sem log | ✅ loga total |
| `POST /payments/confirm/:id` | ✅ parcial | ✅ completo com todos os warns |
| `GET /sales/history/:userId` | ✅ existia | ✅ mantido |
| `GET /health` | ❌ sem log | ✅ interceptor captura automaticamente |
| Qualquer erro 4xx | ❌ sem log | ✅ filter captura automaticamente |
| Qualquer erro 5xx | ❌ sem log | ✅ filter captura automaticamente |

---

# ✅ 8. Checklist

- [x] `LoggerService` reescrito com temas visuais por contexto
- [x] Cores ANSI sem branco — substituído por `gray/silver` neutros
- [x] Verbos HTTP coloridos igual Postman/Insomnia
- [x] Metadata em bold + branco puro, cor aplicada por linha (compatível com Docker)
- [x] `LoggingInterceptor` global — captura todas as requests 2xx
- [x] `HttpExceptionFilter` global — captura todos os erros com nível correto
- [x] Registrados via `APP_INTERCEPTOR` / `APP_FILTER` no `app.module.ts`
- [x] `LoggerModule` com `@Global()` — disponível em toda a aplicação sem reimportar
- [x] Logs adicionados em `SessionService`, `SeatService`, `ReservationService`
- [x] Logs de conexão adicionados no `PrismaService`
- [x] Body gigante removido do interceptor — só loga `id`, `total` ou `statusCode/ms`
- [x] Nível correto por tipo de erro: 4xx → `warn`, 5xx → `error`
- [x] `LOG_JSON=true` suportado para ambientes de produção/observabilidade
---

*PR #10 · @you · status: aguardando revisão*