// update-user.dto.ts
import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TipoEmpleadoEnum } from 'src/enums/type.enum';

export class UpdateUserDto {
@IsNotEmpty()
  ci: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsNotEmpty()
  fullName: string;

  @IsOptional()
  celular?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  profesion?: string;

  @IsNotEmpty()
  @IsDateString() // Valida formato YYYY-MM-DD
  fecha_ingreso: string; // Usar string en lugar de Date para el DTO

  @IsOptional()
  position?: string;

  @IsOptional()
  @IsEnum(TipoEmpleadoEnum)
  tipoEmpleado?: TipoEmpleadoEnum;

  @IsOptional()
  departmentId?: number;
}
