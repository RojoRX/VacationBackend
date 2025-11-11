export class VacationRequestDTO {
  id: number;
  position: string;
  requestDate: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  returnDate: string;
  reviewDate: string;
  postponedDate?: string;
  postponedReason?: string;
  approvedByHR: boolean;
  approvedBySupervisor: boolean;
  approvedBy?: {
    id: number;
    ci: string;
    fecha_ingreso: string;
    username: string;
  };
  managementPeriodStart: string; // Período de gestión
  managementPeriodEnd: string;   // Período de gestión
  user: {
    id: number;
    ci: string;
    fecha_ingreso: string;
    username: string;
    // Dentro de UserDTO
    academicUnitName?: string | null;
    departmentName?: string | null;

  };
    supervisor?: {
    id: number;
    ci: string;
    username: string;
  };
  supervisorId?: number;
}
