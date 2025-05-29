// src/dto/auth/sign-in.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SignInDto {
  @ApiProperty({ example: 'usuario123', description: 'Nombre de usuario o email' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ example: 'mypassword123', description: 'Contraseña del usuario' })
  @IsNotEmpty()
  @IsString()
  password: string;
}
