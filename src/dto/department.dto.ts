// src/dto/department.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ description: 'Nombre del departamento' })
  name: string;

  @ApiProperty({ description: 'Indica si es una carrera' })
  isCareer: boolean;
}

export class UpdateDepartmentDto {
  @ApiProperty({ description: 'Nombre del departamento', required: false })
  name?: string;

  @ApiProperty({ description: 'Indica si es una carrera', required: false })
  isCareer?: boolean;
}
