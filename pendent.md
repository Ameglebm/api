1° criar um fluxograma mental
    Cliente HTTP
        ↓
    Controller (valida entrada)
        ↓
    Service (regra de negócio)
        ↓
    Repository (Prisma)
        ↓
    PostgreSQL (verdade final)

    E em paralelo:
    Service → RedisService (lock temporário 30s)
    Service → Publisher (enfileira evento)
        ↓
    RabbitMQ → Consumer (processa evento em background) --- OK

2° Verificar se tem ordem de implementação --- OK
3° Fazer a base e analisar o --- _Começar agora esse bora_
    prismaService => conecta com banco,
    RedisService => lock atomico,
    RabittmqServuce => enfileira| consome eventos
    OBS: começar por aqui, pq todos os modulos dependem desse para funcionar
    
4° OR 2° Session(crud simples, sem redis para testar inicialmente)
    DTOs (create, response)
    Interfaces (repository, service)
    Repository (Prisma queries)
    Service (lógica: criar sessão + gerar assentos)
    Controller (endpoints REST)
    é o mais simples — não tem lock, não tem evento, só CRUD puro. Serve pra testar se o Prisma tá funcionando.

5° Seat (consulta com Redis)
    DTOs (response)
    Interfaces
    Repository (busca no Postgres)
    Service (cruza Postgres + Redis pra ver se tem lock)
    Controller (GET /seats/:sessionId)
    Precisa cruzar Postgres + Redis, mas ainda não cria nada — só lê. É o próximo nível de complexidade.

6° Reservation (lock Redis + evento)
    DTOs (create, response)
    Interfaces
    Repository (Prisma)
    Service:
    Tenta SET seat:{id} NX PX 30000 no Redis
    Se conseguir → cria Reservation PENDING no Postgres
    Publica evento reservation.created
    Controller (POST /reservations, GET /reservations/:id)
    é onde a race condition é resolvida. Se 10 usuários tentarem ao mesmo tempo, só 1 consegue o lock no Redis.

7° Payment (orquestrador)
    DTOs (response)
    Interfaces (só service)
    Service:
    Valida se expiresAt > now
    Se expirou → retorna 410 Gone
    Se ok → chama SaleRepository pra criar venda
    Atualiza Seat pra SOLD
    Remove lock do Redis (DEL seat:{id})
    Publica evento payment.confirmed
    Controller (POST /payments/confirm/:reservationId)
    Por quê Payment agora? Porque ele orquestra várias peças: Reservation, Sale, Seat, Redis, RabbitMQ.

8° Sale (histórico simples)
    DTOs (response)
    Interfaces
    Repository (Prisma)
    Service (busca por userId)
    Controller (GET /sales/history/:userId)
    Por quê Sale por último? Porque é o mais simples — só lê histórico, não interage com Redis nem eventos.

9° Events (publishers + consumers)
    Publishers:
    ReservationPublisher → publica reservation.created
    PaymentPublisher → publica payment.confirmed
    Consumers:
    ReservationConsumer → escuta reservation.created, agenda verificação de expiração
    PaymentConsumer → escuta payment.confirmed, pode enviar email/notificação
    Por quê events por último? Porque os módulos já funcionam sem eventos — os events são assíncronos e melhoram o sistema, mas não são críticos pro fluxo básico funcionar.
    events por último pq os módulos já funcionam sem eventos — os events são assíncronos e melhoram o sistema, mas não são críticos pro fluxo básico funcionar.

10° Decisões de arquitetura que você precisa entender
Por quê Redis + Postgres juntos?

11° Redis: lock temporário (30s), rápido, atômico (SET NX)
    Postgres: verdade final, permanente, com constraints de unicidade como fallback
    Se o Redis cair, o Postgres ainda protege contra venda dupla via @@unique([sessionId, seatNumber]).
    Por quê RabbitMQ?
    Para eventos assíncronos. Quando a reserva expira, o consumer libera o assento sem precisar de cron job.
    Por quê separar Payment de Sale?
    Payment: orquestra o fluxo (valida, cria venda, atualiza assento)
    Sale: só armazena o registro permanente
    5. Edge cases cobertos
    ✅ Race condition: Redis SET NX garante que só 1 processo adquire o lock
    ✅ Expiração: TTL de 30s no Redis libera automaticamente
    ✅ Deadlock: não acontece porque cada reserva trava 1 assento por vez, sem ordem fixa
    ✅ Idempotência: se o cliente reenviar a mesma requisição, o Redis retorna 409 Conflict (lock já existe)

    separar em arquivos diferentes? verificar se há necessidade
        Porque cada publisher representa um domínio específico da aplicação:
        ? → domínio de comunicação
        Ticket → domínio de ingressos
        Payment → domínio financeiro
        Notificação → domínio de alertas