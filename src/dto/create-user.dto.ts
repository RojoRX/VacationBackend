import { RoleEnum } from 'src/enums/role.enum';
import { TipoEmpleadoEnum } from 'src/enums/type.enum';
import { IsEmail, IsNotEmpty, IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  ci: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsNotEmpty()
  fullName: string;

  @IsOptional()
  celular?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  professionId: number;
  
  @IsOptional()
  academicUnitId: number;


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