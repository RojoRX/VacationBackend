export interface VacationResponse {
  carnetIdentidad: string;
  name: string;
  email: string;
  position: string;
  department: string;
  fechaIngreso: Date;
  permisos: number;
  antiguedadEnAnios: number;
  antiguedadEnMeses: number;
  antiguedadEnDias: number;
  diasDeVacacion: number;
  diasDeVacacionRestantes: number;
  recesos: {
    name: string;
    startDate: Date;
    endDate: Date;
    type: string;
    daysCount: number;
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
  nonHolidayDaysDetails?: { // Nueva sección para detalles de días no hábiles
    date: string;
    reason: string; // Puede ser un texto descriptivo o el nombre del receso
  }[];
}
