import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { VacationPolicyService } from './vacation-policy.service'; // Asegúrate de que la ruta sea correcta

@Injectable()
export class VacationCalculatorService {
  constructor(private readonly vacationPolicyService: VacationPolicyService) { }

  calculateYearsOfService(startDate: DateTime, endDate: DateTime): number {
    return endDate.year - startDate.year - (endDate < startDate.plus({ years: endDate.year - startDate.year }) ? 1 : 0);
  }

  calculateMonthsOfService(startDate: DateTime, endDate: DateTime): number {
    return (endDate.year - startDate.year) * 12 + endDate.month - startDate.month;
  }

  calculateDaysOfService(startDate: DateTime, endDate: DateTime): number {
    return Math.floor(endDate.diff(startDate, 'days').days);
  }

  async calculateVacationDays(yearsOfService: number): Promise<number> {
    if (yearsOfService < 1) return 0; // Manejo de antigüedad menor a 1 año

    // Obtener la política de vacaciones correspondiente a los años de servicio
    const policy = await this.vacationPolicyService.getPolicyByYears(yearsOfService);

    if (policy) {
      return policy.vacationDays; // Retorna los días de vacaciones desde la política
    } else {
      console.warn(`No se encontró política para ${yearsOfService} años de antigüedad.`);
      return 0; // Si no hay política definida, devuelve 0 o maneja como desees
    }
  }



  // Función para contar los días hábiles en el rango
  countWeekdays(startDate: DateTime, endDate: DateTime): number {
    // Asegurarse de trabajar solo con fechas
    startDate = startDate.startOf('day');
    endDate = endDate.startOf('day');

    let count = 0;
    let current = startDate;

    while (current <= endDate) {
      if (current.weekday <= 5) { // 1-5 es lunes a viernes
        count++;
      }
      current = current.plus({ days: 1 });
    }

    return count;
  }

  getIntersectionDays(startDateHol: DateTime, endDateHol: DateTime, nonHolidayDays: any[]): number {
    return nonHolidayDays.filter(nonHoliday => {
      const nonHolidayDate = DateTime.fromISO(nonHoliday.date).startOf('day');
      return nonHolidayDate >= startDateHol && nonHolidayDate <= endDateHol;
    }).length;
  }
}
