export class VacationRequestDTO {
  position: string;
  requestDate: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  returnDate: string;
  user: {
    id: number;
    ci: string;
    fecha_ingreso: string;
    username: string;
    // No incluimos el password ni otros datos sensibles
  };
  postponedDate: string | null;
  postponedReason: string | null;
  id: number;
  approvedByHR: boolean;
  approvedBySupervisor: boolean; // Añadir este campo para el DTO
}
