import { IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(['PENDING', 'AUTHORIZED', 'POSTPONED', 'DENIED', 'SUSPENDED'], {
    message: 'Status must be one of the following: PENDING, AUTHORIZED, POSTPONED, DENIED, SUSPENDED',
  })
  status: string;
}
