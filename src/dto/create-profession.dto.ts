import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProfessionDto {
  @IsNotEmpty()
  @IsString()
  name: string;
}
