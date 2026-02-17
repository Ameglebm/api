src/
├─ models/
│  ├─ sessions/
│  │  ├─ controllers/                 # Endpoints HTTP (CRUD sessões)
│  │  ├─ service/                     # Regras de negócio
│  │  │  └─ sessions.service.interface.ts # Contrato do service
│  │  ├─ repository/                  # Prisma queries
│  │  │  └─ sessions.repository.interface.ts # Contrato do repo
│  │  └─ dtos/
│  │     ├─ create-session.dto.ts
│  │     ├─ update-session.dto.ts
│  │     └─ response-session.dto.ts
│  │
│  ├─ seats/
│  │  ├─ controllers/                 # Consultar disponibilidade
│  │  ├─ service/
│  │  │  └─ seats.service.interface.ts
│  │  ├─ repository/
│  │  │  └─ seats.repository.interface.ts
│  │  └─ dtos/
│  │
│  ├─ reservations/
│  │  ├─ controllers/                 # Reservar assento(s)
│  │  ├─ service/
│  │  │  └─ reservations.service.interface.ts
│  │  ├─ repository/
│  │  │  └─ reservations.repository.interface.ts
│  │  └─ dtos/
│  │
│  ├─ payments/
│  │  ├─ controllers/                 # Confirmar pagamento
│  │  ├─ service/
│  │  │  └─ payments.service.interface.ts
│  │  └─ dtos/
│  │
│  └─ events/                         # Mensageria RabbitMQ
│     ├─ publishers/
│     └─ consumers/
│
├─ app.module.ts                        # Módulo raiz
└─ main.ts                              # Bootstrap NestJS
                                 ┌───────────────┐
                                 │   Clients     │
                                 │(Frontend/API) │
                                 └───────┬───────┘
                                         │ HTTP Requests / REST
                                         ▼
                               ┌───────────────────┐
                               │  sessions/        │
                               │ Controller        │
                               │ Service           │
                               │ Repository        │
                               │ DTOs / Interfaces │
                               └────────┬──────────┘
                                        │
                                        ▼
                               ┌───────────────────┐
                               │    seats/         │
                               │ Controller        │
                               │ Service           │
                               │ Repository        │
                               │ DTOs / Interfaces │
                               └────────┬──────────┘
                                        │
           ┌────────────────────────────┼───────────────────────────┐
           │                            │                           │
           ▼                            ▼                           ▼
 ┌───────────────────┐       ┌───────────────────┐        ┌───────────────────┐
 │ reservations/     │       │ payments/         │        │ events/           │
 │ Controller        │       │ Controller        │        │ publishers        │
 │ Service           │       │ Service           │        │ consumers         │
 │ Repository        │       │ Repository        │        └────────┬──────────┘
 │ DTOs / Interfaces │       │ DTOs / Interfaces │                 │
 └─────────┬─────────┘       └─────────┬─────────┘                 │
           │                        │                               │
           ▼                        ▼                               │
      ┌────────────┐           ┌─────────────┐                       │
      │ Redis/Ttl  │           │  PostgreSQL │                       │
      │ Locks      │           │  DataStore  │                       │
      └────────────┘           └─────────────┘                       │
           │                                                        │
           └───────────────────────────┬────────────────────────────┘
                                       │ RabbitMQ
                                       ▼
                               ┌───────────────────┐
                               │ Events Consumers  │
                               └───────────────────┘

