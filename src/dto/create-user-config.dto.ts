import { IsInt, IsOptional } from 'class-validator';

export class CreateUserConfigDto {
  @IsInt()
  userId: number;

  @IsOptional()
  @IsInt()
  customStartYear?: number;

  @IsOptional()
  @IsInt()
  initialVacationBalance?: number;
}
