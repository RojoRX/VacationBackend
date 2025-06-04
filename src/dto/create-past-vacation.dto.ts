import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
} from 'class-validator';

export class CreatePastVacationDto {
  @IsInt()
  userId: number;

  @IsDateString()
  requestDate: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsEnum(['AUTHORIZED', 'POSTPONED', 'DENIED', 'SUSPENDED'])
  status: string;

  @IsDateString()
  managementPeriodStart: string;

  @IsDateString()
  managementPeriodEnd: string;
}
