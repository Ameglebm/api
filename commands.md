export class SaleRepository implements ISaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ↓ isso é a função
  async findByUserId(userId: string) {

    // ↓ isso é o que a função FAZ: busca no banco
    return this.prisma.sale.findMany({

      where: { userId },          // ← filtro: só vendas desse usuário

      include: {                   // ← "traga junto esses dados relacionados"
        reservation: {             //    Sale → Reservation
          include: {
            seat: {                //    Reservation → Seat
              include: {
                session: true,     //    Seat → Session
              },
            },
          },
        },
      },

      orderBy: { paidAt: 'desc' }, // ← mais recente primeiro
    });
  }
}

É uma função só, mas traz tudo que o histórico precisa numa query só.