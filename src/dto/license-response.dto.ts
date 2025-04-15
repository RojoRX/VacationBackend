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
  userId: number; // ID del usuario
  totalDays: number; // Total de días solicitados
  approvedBySupervisorId?: number | null; // ID del supervisor que aprobó la licencia, opcional si no ha sido aprobado
  approvedBySupervisorName?: string; // Nombre del supervisor, opcional si no ha sido aprobado
  userDepartmentId?: number; // ID del departamento del usuario
  userDepartmentName?: string; // Nombre del departamento del usuario
  supervisorDepartmentId?: number; // ID del departamento del supervisor
  supervisorDepartmentName?: string; // Nombre del departamento del supervisor
}
