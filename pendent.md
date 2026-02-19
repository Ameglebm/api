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

    Sobre usar redis-server /usr/local/etc/redis/redis.conf
    o que melhora?
    Ganha controle fino sobre o Redis.
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

 o dResumireto
    N é obrigatório mas pode ser adicionado depois
    /docker
        redis/
            redis.conf
        postgres/
            init.sql
    docker-compose.yml
    docker-compose.dev.yml
    docker-compose.prod.yml
    
    esta estrutura consegue, tambem analisar depois para melhorar
    Ambiente DEV completo
    Hot reload
    Prisma Studio
    Build rápido
    Volumes montados
    Logs limpos

     Ambiente PROD otimizado
    Imagem pequena
    Node rodando só build final
    Redis com config real
    Postgres com init
    RabbitMQ seguro
    Volumes persistentes
Ajustar depois tambem os private toResponse do service para tudo num local

contruir agora
    Recebe o reservationId
    Valida se a reserva existe e ainda não expirou
    Converte reserva em venda — cria Sale no Postgres
    Atualiza status do assento para SOLD
    Libera o lock do Redis com releaseLock
    Publica payment.confirmed no RabbitMQ

Payment
1. Usuário escolhe assento → POST /reservations
   → Redis trava o assento (lock 30s)
   → Banco cria Reservation com status PENDING
   → Resposta: "teu reservationId é X, tu tem 30 segundos"

2. Dentro dos 30 segundos → POST /payments/confirm/:reservationId
   → Sistema checa: "ainda tá dentro dos 30s?"
   → SIM → confirma tudo: Reservation→CONFIRMED, Seat→SOLD, cria Sale
   → NÃO → 410 Gone "expirou, perdeu"

3. Se o usuário NÃO confirmar em 30s:
   → Redis libera o lock sozinho (TTL expirou)
   → Consumer do RabbitMQ marca Reservation como EXPIRED
   → Assento volta a ficar disponível pra outros
Analisar sobre passar no repository ou não mesmo por conta dos outros serviços se não funcionar? analisar depois novamente e executar<TESTES> importante não deixar de testar aqui!!!

O que acontece quando o pagamento é confirmado
São 3 coisas que mudam no banco ao mesmo tempo:
ANTES do pagamento:
  Reservation → status: PENDING    (esperando pagamento)
  Seat        → status: RESERVED   (travado pro usuário)
  Sale        → não existe ainda

DEPOIS do pagamento confirmado:
  Reservation → status: CONFIRMED  (pagamento feito)
  Seat        → status: SOLD       (vendido, ninguém mais pode comprar)
  Sale        → criada agora       (registro permanente: quem comprou, quando, qual assento)

Ajustar events para ter a separação entre consumers e publishers
Ate agora o sistema só publica eventos
Reserva criada  → publica na fila "reservations"  → ninguém escuta
Pagamento feito → publica na fila "payments"       → ninguém escuta
Sem os consumrs as mensagens ficam acumulando no rabbit sem fazer nada os consumrs são os caras q ficam escutando as filas e fazem algo quando chega uma mensagem, tipo um balconista de um bar q entrega o pedido, procura, ou pega o pedido.
Garçom (Service)     → anota o pedido e coloca no balcão
Balcão (Fila RabbitMQ) → pedidos ficam ali esperando
Balconista (Consumer)  → pega o pedido do balcão e prepara
Sem o balconista, os pedidos acumulam no balcão e ninguém faz nada. O consumer é o cara que fica olhando pro balcão e fala: "chegou pedido novo? deixa eu resolver
ReservationService publica "reserva criada" → fila reservations
                                                    ↓
ReservationConsumer pega a mensagem → espera 30s → expirou? → expira tudo

Publishers (quem coloca o pedido no balcão)
Consumers (quem pega o pedido do balcão)
Consumer→Escuta a fila → EventoO → reservation.consumer.ts, reservations, reservation.created → Espera 30s. Se a reserva ainda tá PENDING → expira (Reservation→EXPIRED, Seat→AVAILABLE) e publica reservation.expired na fila expirations||| payment.consumer.ts, payments, payment.confirmed → Loga a venda. No futuro pode: enviar email, gerar nota fiscal, atualizar dashboard

RESERVA:
  Usuário reserva assento
    → ReservationService cria reserva
    → Publisher publica "reservation.created" na fila reservations
    → Consumer pega a mensagem
    → Espera 30s
    → Checa: ainda PENDING?
       SIM → expira reserva + libera assento + publica na fila expirations
       NÃO → ignora (já pagou)

PAGAMENTO:
  Usuário confirma pagamento
    → PaymentService cria Sale
    → Publisher publica "payment.confirmed" na fila payments
    → Consumer pega a mensagem
    → Loga/processa (email, nota fiscal, etc)

SEM separação (hoje):
  ReservationService → cria reserva + publica evento + validação + lock Redis
  (muita responsabilidade numa classe só)

COM separação:
  ReservationService   → cria reserva
  ReservationPublisher → publica evento
  ReservationConsumer  → escuta e processa expiração
  (cada um faz uma coisa)

  async onModuleInit futuro pode enviar email, gerar nota fiscal, atualizar dashboard já deixei ele pronto para escalar mais

Hoje as interfaces estão espalhadas dentro dos publishers
reservation.publisher.ts → tem ReservationCreatedEvent dentro dele
payment.publisher.ts     → tem PaymentConfirmedEvent dentro dele
tirar de dentro deles e colocar tudo num arquivo só events.types.ts → tem TODAS as interfaces aqui, depois ajusta isso se der tempo

O LoggerModule é @Global() e o LoggerService é @Injectable() sem escopo — isso significa singleton uma única instância pra aplicação inteira entao da isso em tudo, pqp kkkkkk q mole ...kkkkk

vamos criar testes eu vou separar por pastas nao vai ser necessario pasta securiti pq n tem autenticacao.
vai ser assim 
unit > testa cada service isolado (com mocks)
contract > testa shape dos DTOs e status codes dos controllers
flow > testa fluxos completos

unit/Um service sozinho, métodos isolados, Sim tudo mockado "Se reserva não existe lança 404"
contract/Controller recebe X responde com shape Y e status Z Sim "POST /sessions retorna 201 com id, movie, room"
flow/Vários services juntos num fluxo real Sim mas menos "Reserva → paga → seat vira SOLD → sale aparece no histórico"

| Cenário | O que verifica |
|---|---|
| Assento não existe | Para antes do lock → 404 |
| Lock falha | Outro usuário reservou → 409, não cria no banco, não publica |
| Lock sucesso | Cria reserva, publica evento no RabbitMQ |

São 4 mocks porque o service tem 4 dependências:
```
ReservationService → SeatRepository (verifica assento)
                   → RedisService (lock)
                   → ReservationRepository (cria no banco)
                   → RabbitMQService (publica evento)
                   importante esse teste
Realizar testes Eslint e tambem formatar com Eslint e prettier
Criar documentação README.md completa 