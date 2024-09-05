import { LicenseType, TimeRequest } from 'src/entities/license.entity';

export class LicenseResponseDto {
  id: number;
  licenseType: LicenseType;
  timeRequested: TimeRequest;
  startDate: string;
  endDate: string;
  issuedDate: Date;
  immediateSupervisorApproval: boolean;
  personalDepartmentApproval: boolean;
  userId: number; // Solo el ID del usuario es visible
  totalDays: number; // Añadido para incluir el total de días
}
