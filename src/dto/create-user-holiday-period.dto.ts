// src/dto/create-user-holiday-period.dto.ts
import { IsEnum, IsNumber, IsString } from 'class-validator';
import { HolidayPeriodName } from 'src/entities/holydayperiod.entity';

export class CreateUserHolidayPeriodDto {
  @IsEnum(HolidayPeriodName)
  name: HolidayPeriodName;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsNumber()
  userId: number;
}
