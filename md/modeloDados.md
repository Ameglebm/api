# Modelo de Dados - Sistema de Cinema

## Enums

### SeatStatus
- `AVAILABLE` → disponível  
- `RESERVED` → reservado temporariamente  
- `SOLD` → vendido  

### ReservationStatus
- `PENDING` → pendente  
- `CONFIRMED` → confirmada (pagamento feito)  
- `EXPIRED` → expirou (não foi paga no tempo)  

---

## Tabelas / Models

### 1. Session → sessão de cinema (raiz de tudo)
- `id` → identificador da sessão  
- `movie` → nome do filme  
- `room` → sala do cinema  
- `startsAt` → horário de início  
- `ticketPrice` → preço do ingresso  
- `createdAt` → data de criação  
- **Relacionamento:** tem vários assentos (`seats`)  

### 2. Seat → assento do cinema
- `id` → identificador do assento  
- `sessionId` → sessão que ele pertence  
- `seatNumber` → número do assento (único por sessão)  
- `status` → estado atual (`AVAILABLE`, `RESERVED`, `SOLD`)  
- `updatedAt` → último update  
- **Relacionamentos:**  
  - `session` → a sessão  
  - `reservations` → reservas temporárias  
  - `sales` → vendas confirmadas  

### 3. Reservation → reserva temporária (30 segundos)
- `id` → identificador da reserva  
- `seatId` → assento reservado  
- `userId` → usuário que fez a reserva  
- `status` → `PENDING`, `CONFIRMED` ou `EXPIRED`  
- `expiresAt` → quando a reserva expira  
- `createdAt` → data de criação  
- **Relacionamentos:**  
  - `seat` → assento reservado  
  - `sale` → se foi convertida em venda  

### 4. Sale → venda definitiva
- `id` → identificador da venda  
- `reservationId` → reserva correspondente  
- `seatId` → assento vendido  
- `userId` → comprador  
- `paidAt` → data/hora do pagamento  
- **Relacionamentos:**  
  - `reservation` → referência à reserva  
  - `seat` → assento vendido

Como você pode falar sobre as tabelas de forma simples

Session → criei para representar o local e horário do filme, ou seja, é onde a sessão acontece.

Seat → coloquei separado porque é cada assento dentro dessa sessão. Só queria a relação entre “sessão e assento” sem misturar informações da sessão no assento.

Reservation → é quem “segurou” o assento temporariamente. Tem um tempo limitado, e se o pagamento não acontecer, ele some.

Sale → é a venda definitiva, ou seja, quando o assento foi realmente comprado.

💡 Ideia principal: mantive cada coisa separada para não misturar funções diferentes. A Session sabe onde acontece, o Seat representa os lugares, a Reservation é só temporária, e a Sale é final. Assim o sistema fica mais organizado e fácil de controlar concorrência.
