import { IsBoolean, IsDateString, IsInt, IsString } from 'class-validator';

export class NotificationResponseDto {
  @IsInt()
  id: number;  // Identificador único de la notificación

  @IsString()
  message: string;  // El contenido del mensaje de la notificación

  @IsDateString()
  createdAt: string;  // Fecha de creación de la notificación (usualmente como string de tipo ISO 8601)

  @IsBoolean()
  read: boolean;  // Si la notificación ha sido leída o no
}
