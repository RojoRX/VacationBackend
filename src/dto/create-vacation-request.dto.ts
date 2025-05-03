import { IsNotEmpty, IsString, IsObject, ValidateNested } from "class-validator";
export class ManagementPeriodDto {
  @IsNotEmpty()
  @IsString()
  startPeriod: string;

  @IsNotEmpty()
  @IsString()
  endPeriod: string;
}
export class CreateVacationRequestDto {
  @IsNotEmpty()
  @IsString()
  ci: string;

  @IsNotEmpty()
  @IsString()
  startDate: string;

  @IsNotEmpty()
  @IsString()
  position: string;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  managementPeriod: ManagementPeriodDto;

  // El campo endDate se elimina de aquí
}

