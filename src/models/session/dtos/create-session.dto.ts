import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ example: 'Interstellar' })
  @IsNotEmpty({ message: 'Nome do filme não pode estar vazio' })
  @IsString({ message: 'Nome do filme deve ser uma string' })
  movie!: string;

  @ApiProperty({ example: 'Sala 3' })
  @IsNotEmpty({ message: 'Sala não pode estar vazia' })
  @IsString({ message: 'Sala deve ser uma string' })
  room!: string;

  @ApiProperty({ example: '2026-03-01T19:00:00.000Z' })
  @IsNotEmpty({ message: 'Data de início não pode estar vazia' })
  @IsDateString(
    {},
    { message: 'Data de início deve ser uma data válida no formato ISO 8601' },
  )
  startsAt!: string;

  @ApiProperty({ example: 25.0 })
  @IsNotEmpty({ message: 'Preço do ingresso não pode estar vazio' })
  @IsNumber({}, { message: 'Preço do ingresso deve ser um número' })
  @Min(0, { message: 'Preço do ingresso não pode ser negativo' })
  ticketPrice!: number;

  @ApiProperty({ example: 20, minimum: 16 })
  @IsNotEmpty({ message: 'Total de assentos não pode estar vazio' })
  @IsInt({ message: 'Total de assentos deve ser um número inteiro' })
  @Min(16, { message: 'Total de assentos deve ser no mínimo 16' })
  totalSeats!: number;
}
