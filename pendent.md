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
3° Fazer a base e analisar o --- Ok
    prismaService => conecta com banco,
    RedisService => lock atomico,
    RabittmqServuce => enfileira| consome eventos
    OBS: começar por aqui, pq todos os modulos dependem desse para funcionar
    
4° OR 2° Session(crud simples, sem redis para testar inicialmente) --- OK
    DTOs (create, response)
    Interfaces (repository, service)
    Repository (Prisma queries)
    Service (lógica: criar sessão + gerar assentos)
    Controller (endpoints REST)
    é o mais simples — não tem lock, não tem evento, só CRUD puro. Serve pra testar se o Prisma tá funcionando.

5° Seat (consulta com Redis) --- OK
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
     Race condition: Redis SET NX garante que só 1 processo adquire o lock
     Expiração: TTL de 30s no Redis libera automaticamente
     Deadlock: não acontece porque cada reserva trava 1 assento por vez, sem ordem fixa
     Idempotência: se o cliente reenviar a mesma requisição, o Redis retorna 409 Conflict (lock já existe)

    separar em arquivos diferentes? verificar se há necessidade
        Porque cada publisher representa um domínio específico da aplicação:
        ? → domínio de comunicação
        Ticket → domínio de ingressos
        Payment → domínio financeiro
        Notificação → domínio de alertas

    feat: add infra base services

    - PrismaService: conexão com PostgreSQL via Prisma 7
    - RedisService: lock atômico SET NX TTL 30s
    - RabbitMQService: publisher e consumer de eventos

    ✅ 1. Sobre usar redis-server /usr/local/etc/redis/redis.conf

    Você me perguntou:
    o que ganho com isso, o que melhora?
    📌 Ganha controle fino sobre o Redis.
    A imagem oficial do Redis, sem config file, roda 100% no modo padrão, que é bom, mas limitado.
    Ao definir seu redis.conf, você pode:
    Benefícios técnicos reais

    ✔ Evitar perda de dados acidental
    Você pode desativar RDB/AOF caso não precise (em dev).
    Ou ativar snapshots com frequência controlada (em prod).

    ✔ Controlar memória, TTL, eviction policy
    Essencial em sistemas que usam locks com TTL, como seu módulo Reservation.

    Exemplo:
    maxmemory 256mb
    maxmemory-policy allkeys-lru

    ✔ Ativar/Desativar AOF para performance
    AOF deixa persistente mas é mais lento.

    ✔ Remover o warning "using default config"
    Só cosmético, mas fica limpo.

    ✔ Ter configurações diferentes para DEV vs PROD
    Dev: persistência off, máximo desempenho.
    Prod: snapshots, AOF, limites de memória, tuning.

    📌 Resumo direto

    Para seu projeto agora:
    Não é obrigatório, mas é recomendado quando for para PROD.
    Hoje: pode ignorar.
    Profissionalizando: vale muito a pena.
    mande para mim de uma forma mais simples para eu colocar o que pode melhorar aqui q eu vi e tals e o que eu pensei okay
    tambem escalar 
    /docker
        redis/
            redis.conf
        postgres/
            init.sql
    docker-compose.yml
    docker-compose.dev.yml
    docker-compose.prod.yml
    
    🎯 Resultado final

    Com essa estrutura você tem:

    ✔ Ambiente DEV completo

    Hot reload
    Prisma Studio
    Build rápido
    Volumes montados
    Logs limpos

    ✔ Ambiente PROD otimizado

    Imagem pequena
    Node rodando só build final
    Redis com config real
    Postgres com init
    RabbitMQ seguro
    Volumes persistentes

    ✔ Docker em nível profissional