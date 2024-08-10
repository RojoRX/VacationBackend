import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

@Injectable()
export class VacationCalculatorService {
  calculateYearsOfService(startDate: DateTime, endDate: DateTime): number {
    return endDate.diff(startDate, 'years').years;
  }

  calculateMonthsOfService(startDate: DateTime, endDate: DateTime): number {
    return endDate.diff(startDate, 'months').months;
  }

  calculateDaysOfService(startDate: DateTime, endDate: DateTime): number {
    return endDate.diff(startDate, 'days').days;
  }

  calculateVacationDays(yearsOfService: number): number {
    if (yearsOfService >= 10) {
      return 30;
    } else if (yearsOfService >= 5) {
      return 20;
    } else if (yearsOfService >= 1) {
      return 15;
    } else {
      return 0;
    }
  }

  countBusinessDays(startDate: DateTime, endDate: DateTime): number {
    let count = 0;
    let currentDate = startDate.startOf('day'); // Asegura que comience al inicio del día

    while (currentDate <= endDate.endOf('day')) { // Asegura que termine al final del día
      if (currentDate.weekday >= 1 && currentDate.weekday <= 5) { // Lunes a Viernes
        count += 1;
      }
      currentDate = currentDate.plus({ days: 1 });
    }

    return count;
  }

  getIntersectionDays(startDateEmp: DateTime, endDateEmp: DateTime, startDateHol: DateTime, endDateHol: DateTime): number {
    const latestStart = startDateEmp > startDateHol ? startDateEmp : startDateHol;
    const earliestEnd = endDateEmp < endDateHol ? endDateEmp : endDateHol;

    if (latestStart > earliestEnd) {
      return 0;
    }

    return this.countBusinessDays(latestStart, earliestEnd);
  }
}
