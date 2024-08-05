import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { UserService } from 'src/services/user.service';
import { HolidayPeriod, HolidayPeriodType } from 'src/entities/holydayperiod.entity';
import { VacationResponse } from 'src/interfaces/vacation-response.interface';
import { VacationCalculatorService } from 'src/services/vacation-calculator.service';

@Injectable()
export class VacationService {
  constructor(
    @InjectRepository(HolidayPeriod)
    private readonly holidayPeriodRepository: Repository<HolidayPeriod>,
    private readonly userService: UserService,
    private readonly vacationCalculatorService: VacationCalculatorService
  ) {}

  async calculateVacationDays(carnetIdentidad: string, year: number, currentDate: Date): Promise<VacationResponse> {
    const user = await this.userService.findByCarnet(carnetIdentidad).toPromise();
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    const userDate = DateTime.fromISO(user.fechaIngreso);
    const currentDateTime = DateTime.fromJSDate(currentDate);

    const yearsOfService = this.vacationCalculatorService.calculateYearsOfService(userDate, currentDateTime);
    const monthsOfService = this.vacationCalculatorService.calculateMonthsOfService(userDate, currentDateTime);
    const daysOfService = this.vacationCalculatorService.calculateDaysOfService(userDate, currentDateTime);

    const vacationDays = this.vacationCalculatorService.calculateVacationDays(yearsOfService);

    const holidayPeriods = await this.holidayPeriodRepository.find({
      where: {
        year,
        type: HolidayPeriodType.GENERAL,
      },
    });

    let totalNonHolidayDays = 0;
    const recesos = [];

    for (const period of holidayPeriods) {
      const startDateHol = DateTime.fromJSDate(period.startDate);
      const endDateHol = DateTime.fromJSDate(period.endDate);

      const startDateEmp = userDate;
      const endDateEmp = currentDateTime;

      const intersectionDays = getIntersectionDays(startDateEmp, endDateEmp, startDateHol, endDateHol);
      totalNonHolidayDays += intersectionDays;

      recesos.push({
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        type: period.type,
        daysCount: intersectionDays,
      });
    }

    return {
      carnetIdentidad: user.carnetIdentidad,
      name: user.name,
      email: user.email,
      position: user.position,
      department: user.department,
      fechaIngreso: new Date(user.fechaIngreso), // Convertir a Date
      permisos: user.permisos,
      antiguedadEnAnios: Math.floor(yearsOfService),
      antiguedadEnMeses: Math.floor(monthsOfService),
      antiguedadEnDias: Math.floor(daysOfService),
      diasDeVacacion: vacationDays - totalNonHolidayDays,
      recesos: recesos,
      diasNoHabiles: totalNonHolidayDays,
    };
  }
}

function countBusinessDays(startDate: DateTime, endDate: DateTime): number {
  let count = 0;
  let currentDate = startDate;

  while (currentDate <= endDate) {
    if (currentDate.weekday >= 1 && currentDate.weekday <= 5) { // Lunes a Viernes
      count += 1;
    }
    currentDate = currentDate.plus({ days: 1 });
  }

  return count;
}

function getIntersectionDays(startDateEmp: DateTime, endDateEmp: DateTime, startDateHol: DateTime, endDateHol: DateTime): number {
  const latestStart = startDateEmp > startDateHol ? startDateEmp : startDateHol;
  const earliestEnd = endDateEmp < endDateHol ? endDateEmp : endDateHol;

  if (latestStart > earliestEnd) {
    return 0;
  }

  return countBusinessDays(latestStart, earliestEnd);
}
