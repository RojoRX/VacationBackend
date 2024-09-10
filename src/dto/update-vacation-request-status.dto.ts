// src/dto/update-vacation-request-status.dto.ts
import { IsEnum, IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateVacationRequestStatusDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @IsEnum(['PENDING', 'AUTHORIZED', 'POSTPONED', 'DENIED', 'SUSPENDED'])
  @IsNotEmpty()
  status: string;
}
