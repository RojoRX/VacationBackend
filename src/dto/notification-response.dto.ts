import { IsBoolean, IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class NotificationResponseDto {
  @IsInt()
  id: number;

  @IsString()
  message: string;

  @IsDateString()
  createdAt: string;

  @IsBoolean()
  read: boolean;

  @IsOptional()
  @IsString()
  resourceType?: 'VACATION' | 'LICENSE';  // Tipo de recurso (opcional)

  @IsOptional()
  @IsInt()
  resourceId?: number;  // ID del recurso (opcional)
}
