// dto/create-vacation-request.dto.ts
export class CreateVacationRequestDto {
    ci: string;              // Carnet de identidad del usuario
    startDate: string;       // Fecha de inicio de vacaciones
    endDate: string;         // Fecha de fin de vacaciones
    position: string;        // Cargo del usuario
  }
  