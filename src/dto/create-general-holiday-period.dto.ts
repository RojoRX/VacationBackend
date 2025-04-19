import { IsString, IsDateString, IsInt, Min, Max } from 'class-validator';

export class CreateGeneralHolidayPeriodDto {
  @IsString()
  name: string;
/*
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;
*/
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
