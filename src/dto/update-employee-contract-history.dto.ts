// src/dto/update-employee-contract-history.dto.ts
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ContractType } from 'src/enums/contract-type.enum';

export class UpdateEmployeeContractHistoryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;
}
