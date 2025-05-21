import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CredentialDto {
  @ApiPropertyOptional({ description: 'Nombre de usuario deseado' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Contraseña deseada (si no se proporciona, se genera una temporal)' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
