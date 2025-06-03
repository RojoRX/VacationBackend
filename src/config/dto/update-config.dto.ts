// dto/update-config.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSystemConfigDto {
  @IsString()
  @IsNotEmpty()
  value: string;
}
