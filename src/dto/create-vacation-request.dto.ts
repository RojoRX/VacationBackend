export class CreateVacationRequestDto {
  ci: string;                     // Carnet de identidad del usuario
  startDate: string;              // Fecha de inicio de vacaciones
  endDate: string;                // Fecha de fin de vacaciones
  position: string;               // Cargo del usuario
  managementPeriodStart: string;  // Fecha de inicio del período de gestión
  managementPeriodEnd: string;    // Fecha de fin del período de gestión
}
