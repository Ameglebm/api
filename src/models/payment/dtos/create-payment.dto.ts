import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-reserva' })
  @IsNotEmpty({ message: 'ID da reserva não pode estar vazio' })
  @IsUUID('4', { message: 'ID da reserva deve ser um UUID válido' })
  reservationId!: string;

  @ApiProperty({ example: 'usuario-001' })
  @IsNotEmpty({ message: 'ID do usuário não pode estar vazio' })
  @IsString({ message: 'ID do usuário deve ser uma string' })
  userId!: string;
}
