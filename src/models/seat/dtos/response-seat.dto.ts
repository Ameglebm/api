import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { SeatStatus } from '../../../common/enums/seat-status.enum';

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

  @ApiProperty({ example: false })
  @Expose()
  isLocked!: boolean;
}
