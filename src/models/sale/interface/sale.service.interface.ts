import { ResponseSaleDto } from '../dtos/response-sale.dto';
export interface ISaleService {
  findByUserId(userId: string): Promise<ResponseSaleDto[]>;
}
