import { CreateSessionDto } from '../dtos/create-session.dto';
import { ResponseSessionDto } from '../dtos/response-session.dto';

export interface ISessionService {
  create(dto: CreateSessionDto): Promise<ResponseSessionDto>;
  findAll(): Promise<ResponseSessionDto[]>;
  findById(id: string): Promise<ResponseSessionDto>;
}

export const SESSION_SERVICE = 'SESSION_SERVICE';
