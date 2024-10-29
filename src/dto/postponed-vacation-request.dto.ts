import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class PostponeVacationRequestDTO {
  @ApiProperty({
    description: 'The new date to which the vacation request is postponed',
    example: '2024-12-01',
  })
  @IsDateString()
  @IsNotEmpty()
  postponedDate: string;

  @ApiProperty({
    description: 'The reason for postponing the vacation request',
    example: 'Project deadlines',
  })
  @IsString()
  @IsNotEmpty()
  postponedReason: string;
}
