import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

@Injectable()
export class VacationCalculatorService {
  calculateYearsOfService(startDate: DateTime, endDate: DateTime): number {
    return endDate.year - startDate.year - (endDate < startDate.plus({ years: endDate.year - startDate.year }) ? 1 : 0);
  }

  calculateMonthsOfService(startDate: DateTime, endDate: DateTime): number {
    return (endDate.year - startDate.year) * 12 + endDate.month - startDate.month;
  }

  calculateDaysOfService(startDate: DateTime, endDate: DateTime): number {
    return Math.floor(endDate.diff(startDate, 'days').days);
  }

  calculateVacationDays(yearsOfService: number): number {
    if (yearsOfService < 1) return 0;
    if (yearsOfService <= 5) return 15;
    if (yearsOfService <= 10) return 20;
    return 30;
  }

 // Función para contar los días hábiles en el rango
 countWeekdays(startDate: DateTime, endDate: DateTime): number {
  let count = 0;
  let current = startDate.startOf('day').plus({ days: 1 }); // Inicia al siguiente día

  while (current < endDate) {
    if (current.weekday >= 1 && current.weekday <= 5) {
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
