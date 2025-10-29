// vacation-postpone.dto.ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VacationPostponeDto {
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'La observación no puede superar 300 caracteres' })
  postponedReason?: string;

  @IsOptional()
  postponedDate?: string; // opcional, si quieres permitir indicar fecha de postergación
}
