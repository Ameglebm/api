import { ApiProperty } from '@nestjs/swagger';
import { ReservationStatus } from '../../../common/enums/reservation-status.enum';

export class ResponseReservationDto {
  @ApiProperty({ example: 'uuid-reserva' })
  id!: string;

  @ApiProperty({ example: 'uuid-sessao' })
  sessionId!: string;

  @ApiProperty({ example: 'uuid-assento' })
  seatId!: string;

  @ApiProperty({ example: 'uuid-usuario' })
  userId!: string;

  @ApiProperty({ enum: ReservationStatus, example: ReservationStatus.PENDING })
  status!: ReservationStatus;

  @ApiProperty({ example: '2026-02-18T19:00:00.000Z' })
  expiresAt!: Date;

  @ApiProperty({ example: '2026-02-18T18:59:30.000Z' })
  createdAt!: Date;
}
