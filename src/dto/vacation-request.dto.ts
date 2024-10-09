export class VacationRequestDTO {
  id: number;
  position: string;
  requestDate: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  returnDate: string;
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
  };
}
