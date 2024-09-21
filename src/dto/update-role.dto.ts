// src/dto/update-role.dto.ts
import { IsEnum } from 'class-validator';
import { RoleEnum } from 'src/enums/role.enum';

export class UpdateRoleDto {
  @IsEnum(RoleEnum)
  role: RoleEnum;
}
