import { IsString, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class UserReportFilterDto {
  @IsString()
  @IsNotEmpty()
  ci: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  month?: number;
}