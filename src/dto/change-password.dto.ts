import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'miContraseñaActual123' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ example: 'NuevaContraseñaSegura123!' })
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  newPassword: string;
}
