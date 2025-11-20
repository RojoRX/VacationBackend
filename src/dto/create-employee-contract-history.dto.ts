// src/dto/create-employee-contract-history.dto.ts
import { IsDateString, IsEnum, IsInt, Min } from 'class-validator';
import { ContractType } from 'src/enums/contract-type.enum';

export class CreateEmployeeContractHistoryDto {
  @IsInt()
  @Min(1)
  userId: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate?: string;

  @IsEnum(ContractType)
  contractType: ContractType;
}
