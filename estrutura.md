# 🎬 Cinema Ticket API — Progress

## 🐳 Infraestrutura Docker
| Arquivo | Status |
|---|---|
| `docker-compose.yml` | ✅ 5 containers rodando |
| `Dockerfile` | ✅ OK |
| Postgres healthcheck | ✅ `pg_isready` |
| RabbitMQ healthcheck | ✅ `rabbitmq-diagnostics ping` |
| Redis | ✅ `service_started` |
| Prisma Studio container | ✅ `logging: none` |

---

## ⚙️ Infra Base (`src/infra/`)
| Arquivo | Status |
|---|---|
| `prisma/prisma.service.ts` | ✅ `PrismaPg` adapter, connect/disconnect |
| `prisma/prisma.module.ts` | ✅ exportado |
| `redis/redis.service.ts` | ✅ `acquireLock` · `releaseLock` · `isLocked` |
| `redis/redis.module.ts` | ✅ OK |
| `rabbitmq/rabbitmq.service.ts` | ✅ connect · publish · consume · DLQ · prefetch |
| `rabbitmq/rabbitmq.module.ts` | ✅ OK |

---

## 🧰 Common (`src/common/`)
| Arquivo | Status |
|---|---|
| `enums/seat-status.enum.ts` | ✅ `AVAILABLE · RESERVED · SOLD` |
| `enums/reservation-status.enum.ts` | ✅ `PENDING · CONFIRMED · EXPIRED` |
| `filters/http-exception.filter.ts` | ✅ filtro global de erros |
| `logger/logger.service.ts` | ✅ 4 níveis · badge colorido · borda lateral · JSON opcional |
| `logger/logger.module.ts` | ✅ `@Global()` |

---

## 🚀 App Root (`src/`)
| Arquivo | Status |
|---|---|
| `main.ts` | ✅ CORS · ValidationPipe · Swagger · banner |
| `app.module.ts` | ✅ sem duplicação de providers |
| `app.controller.ts` | ✅ health check |
| `app.service.ts` | ✅ OK |

---

## 🗄 Prisma
| Arquivo | Status |
|---|---|
| `prisma/schema.prisma` | ✅ 4 models · 2 enums · `@@unique` |
| `prisma.config.ts` | ✅ Prisma 7 · datasource via config |
| `migrations/20260217135942_init` | ✅ aplicada |

---

## 📦 Models (`src/models/`)

### Session
| Arquivo | Status |
|---|---|
| `controller/session.controller.ts` | ⬜ esqueleto |
| `dtos/create-session.dto.ts` | ⬜ esqueleto |
| `dtos/response-session.dto.ts` | ⬜ esqueleto |
| `interface/session.repository.interface.ts` | ⬜ esqueleto |
| `interface/session.service.interface.ts` | ⬜ esqueleto |
| `repository/session.repository.ts` | ⬜ vazio |
| `service/session.service.ts` | ⬜ vazio |
| `session.module.ts` | ⬜ esqueleto |
| `session.constants.ts` | ⬜ esqueleto |

### Seat
| Arquivo | Status |
|---|---|
| `controller/seat.controller.ts` | ⬜ esqueleto |
| `dtos/` | ⬜ esqueleto |
| `interface/` | ⬜ esqueleto |
| `repository/seat.repository.ts` | ⬜ esqueleto |
| `service/seat.service.ts` | ⬜ esqueleto |
| `seat.module.ts` | ⬜ esqueleto |

### Reservation
| Arquivo | Status |
|---|---|
| `controller/reservation.controller.ts` | ⬜ esqueleto |
| `dtos/` | ⬜ esqueleto |
| `interface/` | ⬜ esqueleto |
| `repository/reservation.repository.ts` | ⬜ esqueleto |
| `service/reservation.service.ts` | ⬜ esqueleto |
| `reservation.module.ts` | ⬜ esqueleto |

### Payment
| Arquivo | Status |
|---|---|
| `controller/payment.controller.ts` | ⬜ esqueleto |
| `dtos/` | ⬜ esqueleto |
| `interface/payment.interface.service.ts` | ⬜ esqueleto |
| `service/` | 🔴 vazio — sem arquivo |
| `payment.module.ts` | ⬜ esqueleto |

### Sale
| Arquivo | Status |
|---|---|
| `controller/sale.controller.ts` | ⬜ esqueleto |
| `dtos/` | ⬜ esqueleto |
| `interface/` | ⬜ esqueleto |
| `repository/sale.repository.ts` | ⬜ esqueleto |
| `service/sale.service.ts` | ⬜ esqueleto |
| `sale.module.ts` | ⬜ esqueleto |

---

## 📨 Events (`src/events/`)
| Arquivo | Status |
|---|---|
| `publishers/reservation.publisher.ts` | ⬜ esqueleto |
| `publishers/payment.publisher.ts` | ⬜ esqueleto |
| `consumers/reservation.consumer.ts` | ⬜ esqueleto |
| `consumers/payment.consumer.ts` | ⬜ esqueleto |

---

## 🔜 Próximos passos (em ordem)
1. `session` — repository + service + controller + DTOs
2. `seat` — repository + service + controller
3. `reservation` — lock Redis + evento
4. `payment` — orquestrador
5. `sale` — histórico
6. `events` — publishers + consumers