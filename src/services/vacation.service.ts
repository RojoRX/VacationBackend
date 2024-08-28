import { BadRequestException, Injectable } from '@nestjs/common';
import { UserService } from 'src/services/user.service';
import { NonHolidayService } from './nonholiday.service';
import { VacationResponse } from 'src/interfaces/vacation-response.interface';
import { VacationCalculatorService } from 'src/services/vacation-calculator.service';
import { RecesoService } from './receso.service';
import { DateTime } from 'luxon';

@Injectable()
export class VacationService {
  constructor(
    private readonly userService: UserService,
    private readonly vacationCalculatorService: VacationCalculatorService,
    private readonly nonHolidayService: NonHolidayService,
    private readonly recesoService: RecesoService
  ) { }

  async calculateVacationDays(carnetIdentidad: string, startDate: Date, endDate: Date): Promise<VacationResponse> {
    const user = await this.userService.findByCarnet(carnetIdentidad).toPromise();
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    const userDate = DateTime.fromISO(user.attributes.fecha_ingreso);
    const startDateTime = DateTime.fromJSDate(startDate).startOf('day');
    const endDateTime = DateTime.fromJSDate(endDate).endOf('day');

    const yearsOfService = this.vacationCalculatorService.calculateYearsOfService(userDate, endDateTime);
    const monthsOfService = this.vacationCalculatorService.calculateMonthsOfService(userDate, endDateTime);
    const daysOfService = this.vacationCalculatorService.calculateDaysOfService(userDate, endDateTime);

    const vacationDays = this.vacationCalculatorService.calculateVacationDays(yearsOfService);

    // Modificar para que solo se obtengan recesos generales
    const { generalHolidayPeriods } = await this.recesoService.getHolidayPeriods(startDateTime.year);
    const nonHolidayDays = await this.nonHolidayService.getNonHolidayDays(startDateTime.year);

    const recesos = [];
    let totalNonHolidayDays = 0;
    const nonHolidayDetails = [];

    // Procesar recesos generales
    for (const period of generalHolidayPeriods) {
      const startDateHol = DateTime.fromJSDate(period.startDate).startOf('day');
      const endDateHol = DateTime.fromJSDate(period.endDate).endOf('day');

      const totalDays = this.vacationCalculatorService.countWeekdays(startDateHol, endDateHol);
      const nonHolidayDaysCount = this.vacationCalculatorService.getIntersectionDays(startDateHol, endDateHol, nonHolidayDays);

      totalNonHolidayDays += nonHolidayDaysCount;

      nonHolidayDays.forEach(nonHoliday => {
        const nonHolidayDate = DateTime.fromISO(nonHoliday.date).startOf('day');
        if (nonHolidayDate >= startDateHol && nonHolidayDate <= endDateHol) {
          nonHolidayDetails.push({
            date: nonHoliday.date,
            reason: `Dentro del receso general ${period.name}`
          });
        }
      });

      recesos.push({
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        type: period.type,
        totalDays: totalDays,
        nonHolidayDays: nonHolidayDaysCount,
        daysCount: totalDays - nonHolidayDaysCount
      });
    }

    const totalVacationDaysUsed = recesos.reduce((total, receso) => total + receso.daysCount, 0);
    const remainingVacationDays = vacationDays - totalVacationDaysUsed;

    return {
      carnetIdentidad: user.attributes.ci,
      name: user.attributes.nombres,
      email: user.attributes.correo_electronico,
      position: user.attributes.profesion,
      fechaIngreso: new Date(user.attributes.fecha_ingreso),
      antiguedadEnAnios: Math.floor(yearsOfService),
      antiguedadEnMeses: Math.floor(monthsOfService),
      antiguedadEnDias: Math.floor(daysOfService),
      diasDeVacacion: vacationDays,
      diasDeVacacionRestantes: remainingVacationDays,
      recesos: recesos,
      diasNoHabiles: totalNonHolidayDays,
      nonHolidayDaysDetails: nonHolidayDetails
    };
  }
}

