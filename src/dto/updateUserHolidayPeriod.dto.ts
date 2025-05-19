import { IsOptional, IsString, IsDateString, IsEnum, IsInt } from 'class-validator';
import { HolidayPeriodName } from 'src/entities/holydayperiod.entity';

export class UpdateUserHolidayPeriodDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(HolidayPeriodName)
  name?: HolidayPeriodName;

  @IsOptional()
  @IsInt()
  year?: number;
}
