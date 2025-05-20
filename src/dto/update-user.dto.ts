// update-user.dto.ts
import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
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
  @IsNumber()
  professionId?: number;

  @IsOptional()
  @IsNumber()
  academicUnitId?: number;


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
