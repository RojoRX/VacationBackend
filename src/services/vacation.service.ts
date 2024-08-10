import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { UserService } from 'src/services/user.service';
import { HolidayPeriod, HolidayPeriodType } from 'src/entities/holydayperiod.entity';
import { VacationResponse } from 'src/interfaces/vacation-response.interface';
import { VacationCalculatorService } from 'src/services/vacation-calculator.service';
import { NonHolidayService } from './nonholiday.service';

@Injectable()
export class VacationService {
  constructor(
    @InjectRepository(HolidayPeriod)
    private readonly holidayPeriodRepository: Repository<HolidayPeriod>,
    private readonly userService: UserService,
    private readonly vacationCalculatorService: VacationCalculatorService,
    private readonly nonHolidayService: NonHolidayService
  ) { }

  async calculateVacationDays(carnetIdentidad: string, startDate: Date, endDate: Date): Promise<VacationResponse> {
    const user = await this.userService.findByCarnet(carnetIdentidad).toPromise();
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    const userDate = DateTime.fromISO(user.fechaIngreso);
    const startDateTime = DateTime.fromJSDate(startDate);
    const endDateTime = DateTime.fromJSDate(endDate);

    const yearsOfService = this.vacationCalculatorService.calculateYearsOfService(userDate, endDateTime);
    const monthsOfService = this.vacationCalculatorService.calculateMonthsOfService(userDate, endDateTime);
    const daysOfService = this.vacationCalculatorService.calculateDaysOfService(userDate, endDateTime);

    const vacationDays = this.vacationCalculatorService.calculateVacationDays(yearsOfService);

    // Obtener recesos específicos para el departamento del usuario
    const specificHolidayPeriods = await this.holidayPeriodRepository.find({
      where: {
        year: startDateTime.year,
        type: HolidayPeriodType.SPECIFIC,
        career: user.department
      },
    });

    // Obtener recesos generales
    const generalHolidayPeriods = await this.holidayPeriodRepository.find({
      where: {
        year: startDateTime.year,
        type: HolidayPeriodType.GENERAL,
      },
    });

    // Obtener días no hábiles
    const nonHolidayDays = await this.nonHolidayService.getNonHolidayDays(startDateTime.year);

    const recesos = [];
    let totalNonHolidayDays = 0;
    const nonHolidayDetails = [];
    // Función para contar los días hábiles en el rango
   // Función para contar los días hábiles en el rango
   function countWeekdays(startDate: DateTime, endDate: DateTime): number {
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
  
  

  
  // Función para obtener la intersección de días no hábiles en un rango
  const getIntersectionDays = (startDateHol: DateTime, endDateHol: DateTime, nonHolidayDays: any[]): number => {
    return nonHolidayDays.filter(nonHoliday => {
      const nonHolidayDate = DateTime.fromISO(nonHoliday.date);
      return nonHolidayDate >= startDateHol && nonHolidayDate <= endDateHol;
    }).length;
  };

// Procesar recesos específicos
for (const period of specificHolidayPeriods) {
  const startDateHol = DateTime.fromJSDate(period.startDate);
  const endDateHol = DateTime.fromJSDate(period.endDate);

  console.log(`Processing specific holiday period: ${period.name}`);
  console.log(`Start date: ${startDateHol.toISO()}, End date: ${endDateHol.toISO()}`);

  const totalDays = countWeekdays(startDateHol, endDateHol);
  const nonHolidayDaysCount = getIntersectionDays(startDateHol, endDateHol, nonHolidayDays);

  console.log(`Total days for ${period.name}: ${totalDays}, Non-holiday days: ${nonHolidayDaysCount}`);

  totalNonHolidayDays += nonHolidayDaysCount;

  nonHolidayDays.forEach(nonHoliday => {
    const nonHolidayDate = DateTime.fromISO(nonHoliday.date);
    if (nonHolidayDate >= startDateHol.startOf('day') && nonHolidayDate <= endDateHol.endOf('day')) {
      nonHolidayDetails.push({
        date: nonHoliday.date,
        reason: `Dentro del receso específico ${period.name}`
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

// Procesar recesos generales que no están cubiertos por los específicos
for (const period of generalHolidayPeriods) {
  const isCoveredBySpecific = specificHolidayPeriods.some(specificPeriod =>
    (DateTime.fromJSDate(specificPeriod.startDate) <= DateTime.fromJSDate(period.endDate) &&
      DateTime.fromJSDate(specificPeriod.endDate) >= DateTime.fromJSDate(period.startDate))
  );

  console.log(`Processing general holiday period: ${period.name}`);
  console.log(`Is covered by specific holiday: ${isCoveredBySpecific}`);

  if (!isCoveredBySpecific) {
    const startDateHol = DateTime.fromJSDate(period.startDate);
    const endDateHol = DateTime.fromJSDate(period.endDate);

    console.log(`Start date: ${startDateHol.toISO()}, End date: ${endDateHol.toISO()}`);

    const totalDays = countWeekdays(startDateHol, endDateHol);
    const nonHolidayDaysCount = getIntersectionDays(startDateHol, endDateHol, nonHolidayDays);

    console.log(`Total days for ${period.name}: ${totalDays}, Non-holiday days: ${nonHolidayDaysCount}`);

    totalNonHolidayDays += nonHolidayDaysCount;

    nonHolidayDays.forEach(nonHoliday => {
      const nonHolidayDate = DateTime.fromISO(nonHoliday.date);
      if (nonHolidayDate >= startDateHol.startOf('day') && nonHolidayDate <= endDateHol.endOf('day')) {
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
}

const totalVacationDaysUsed = recesos.reduce((total, receso) => total + receso.daysCount, 0);
const remainingVacationDays = vacationDays - totalVacationDaysUsed;

console.log(`Total vacation days used: ${totalVacationDaysUsed}`);
console.log(`Remaining vacation days: ${remainingVacationDays}`);

return {
  carnetIdentidad: user.carnetIdentidad,
  name: user.name,
  email: user.email,
  position: user.position,
  department: user.department,
  fechaIngreso: new Date(user.fechaIngreso),
  permisos: user.permisos,
  antiguedadEnAnios: Math.floor(yearsOfService),
  antiguedadEnMeses: Math.floor(monthsOfService),
  antiguedadEnDias: Math.floor(daysOfService),
  diasDeVacacion: vacationDays, // Total de días de vacaciones asignados
  diasDeVacacionRestantes: remainingVacationDays, // Días de vacaciones restantes
  recesos: recesos,
  diasNoHabiles: totalNonHolidayDays,
  nonHolidayDaysDetails: nonHolidayDetails
}}}
