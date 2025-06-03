import { IsInt, IsOptional } from 'class-validator';

export class UpdateUserConfigDto {
  @IsOptional()
  @IsInt()
  customStartYear?: number;

  @IsOptional()
  @IsInt()
  initialVacationBalance?: number;
}
