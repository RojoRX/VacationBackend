import { LicenseResponseDto } from "src/dto/license-response.dto";
import { VacationRequest } from "src/entities/vacation_request.entity";

export interface VacationResponse {
  carnetIdentidad: string;
  name: string;
  email: string;
  position: string;
  fechaIngreso: Date;
  antiguedadEnAnios: number;
  antiguedadEnMeses: number;
  antiguedadEnDias: number;
  diasDeVacacion: number;
  diasDeVacacionRestantes: number;
  deuda:number;
  //deudaAcumulativa: number,
  recesos: {
    name: string;
    startDate: Date;
    endDate: Date;
    type: string; // Indica si es general o personalizado
    daysCount: number; // Total de días hábiles descontados
  }[];
  diasNoHabiles: number;
  detailedPeriods?: {
    specific: {
      name: string;
      startDate: string;
      endDate: string;
      intersectionDays: number;
    }[];
    general: {
      name: string;
      startDate: string;
      endDate: string;
      intersectionDays: number;
    }[];
  };
  nonHolidayDaysDetails?: {
    date: string;
    reason: string; // Detalle del día no hábil
  }[];
  licenciasAutorizadas?: { // Nuevo campo para licencias autorizadas
    totalAuthorizedDays: number; // Número total de días autorizados
    requests: LicenseResponseDto[]; // Detalles de las licencias
  };
  solicitudesDeVacacionAutorizadas?: {
    totalAuthorizedVacationDays: number,
    requests: VacationRequest[];
  }

}
