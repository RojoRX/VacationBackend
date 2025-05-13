// report-filter.dto.ts
import { IsOptional, IsIn, IsNumber } from 'class-validator';

export class ReportFilterDto {
  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsNumber()
  month?: number;

  @IsOptional()
  @IsIn(['DOCENTE', 'ADMINISTRATIVO', 'ALL'], {
    message: 'El tipo debe ser DOCENTE, ADMINISTRATIVO o ALL',
  })
  employeeType?: string = 'ALL';
}