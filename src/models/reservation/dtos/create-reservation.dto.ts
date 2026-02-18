import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ example: 'uuid-assento' })
  @IsNotEmpty({ message: 'ID do assento não pode estar vazio' })
  @IsUUID('4', { message: 'ID do assento deve ser um UUID válido' })
  seatId!: string;

  @ApiProperty({ example: 'uuid-usuario' })
  @IsNotEmpty({ message: 'ID do usuário não pode estar vazio' })
  @IsString({ message: 'ID do usuário deve ser uma string' })
  userId!: string;
}