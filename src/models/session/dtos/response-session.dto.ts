import { ApiProperty } from '@nestjs/swagger';
import { SeatStatus } from '../../../common/enums/seat-status.enum';
import { Expose, Type } from 'class-transformer';

export class ResponseSeatDto {
  @ApiProperty({ example: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'A1' })
  @Expose()
  seatNumber!: string;

  @ApiProperty({ enum: SeatStatus, example: SeatStatus.AVAILABLE })
  @Expose()
  status!: SeatStatus;
}

export class ResponseSessionDto {
  @ApiProperty({ example: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Interstellar' })
  @Expose()
  movie!: string;

  @ApiProperty({ example: 'Sala 3' })
  @Expose()
  room!: string;

  @ApiProperty({ example: '2026-03-01T19:00:00.000Z' })
  @Expose()
  startsAt!: Date;

  @ApiProperty({ example: 25.0 })
  @Expose()
  ticketPrice!: number;

  @ApiProperty({ example: '2026-02-18T00:00:00.000Z' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: [ResponseSeatDto], required: false })
  @Expose()
  @Type(() => ResponseSeatDto)
  seats?: ResponseSeatDto[];
}
