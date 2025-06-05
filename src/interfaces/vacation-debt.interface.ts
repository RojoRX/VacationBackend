// src/interfaces/vacation-debt.interface.ts

/**
 * Representa los detalles de la acumulación y uso de días de vacaciones
 * para una gestión o período específico.
 */
export interface DetalleGestion {
  /** Fecha de inicio del período de gestión. */
  startDate: string;
  /** Fecha de fin del período de gestión. */
  endDate: string;
  /** Días de deuda acumulada en esta gestión (si es positivo, días a favor; si es negativo, días debidos). */
  deuda: number;
  /** Días de vacaciones generados en esta gestión. */
  diasDeVacacion: number;
  /** Días de vacaciones restantes al final de esta gestión (antes de la acumulación a la siguiente). */
  diasDeVacacionRestantes: number;
  /** Deuda acumulativa hasta el final de esta gestión. */
  deudaAcumulativaHastaEstaGestion: number;
  /** Deuda acumulativa del período anterior. */
  deudaAcumulativaAnterior: number;
  /** Días disponibles para solicitar al final de esta gestión, considerando acumulaciones.
   * Este es el valor clave para la proyección y validación.
   */
  diasDisponibles: number;
}

/**
 * Proporciona un resumen general del estado de la deuda de vacaciones de un usuario.
 */
export interface ResumenGeneral {
  /** La deuda total acumulada de todas las gestiones. */
  deudaTotal: number;
  /** Los días de vacaciones disponibles actualmente para el usuario. */
  diasDisponiblesActuales: number;
  /** Número de gestiones en las que el usuario tuvo deuda. */
  gestionesConDeuda: number;
  /** Número de gestiones en las que el usuario no tuvo deuda (o tuvo saldo a favor). */
  gestionesSinDeuda: number;
  /** Promedio de la deuda por gestión. */
  promedioDeudaPorGestion: number;
  /** Fecha de inicio de la primera gestión registrada. */
  primeraGestion: string;
  /** Fecha de fin de la última gestión registrada. */
  ultimaGestion: string;
}