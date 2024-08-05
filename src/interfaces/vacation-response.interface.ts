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
  recesos: {
    name: string;
    startDate: Date;
    endDate: Date;
    type: string;
    daysCount: number;
  }[];
  diasNoHabiles: number;
}
