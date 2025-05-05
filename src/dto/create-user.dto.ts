import { RoleEnum } from 'src/enums/role.enum';
import { TipoEmpleadoEnum } from 'src/enums/type.enum';
import { IsEmail, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  ci: string;

  @IsNotEmpty()
  @IsEmail()
  username: string;

  @IsNotEmpty()
  password: string;

  @IsNotEmpty()
  fullName: string;

  @IsOptional()
  celular?: string;

  @IsOptional()
  @IsEmail()
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
  @IsEnum(RoleEnum)
  role?: RoleEnum;

  @IsOptional()
  departmentId?: number;
}