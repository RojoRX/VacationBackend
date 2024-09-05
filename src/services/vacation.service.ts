import { BadRequestException, Injectable } from '@nestjs/common';
import { UserService } from 'src/services/user.service';
import { NonHolidayService } from './nonholiday.service';
import { VacationResponse } from 'src/interfaces/vacation-response.interface';
import { VacationCalculatorService } from 'src/services/vacation-calculator.service';
import { RecesoService } from './receso.service';
import { UserHolidayPeriodService } from './userholidayperiod.service'; // Importar el servicio de recesos personalizados
import { DateTime } from 'luxon';

@Injectable()
export class VacationService {
  constructor(
    private readonly userService: UserService,
    private readonly vacationCalculatorService: VacationCalculatorService,
    private readonly nonHolidayService: NonHolidayService,
    private readonly recesoService: RecesoService,
    private readonly userHolidayPeriodService: UserHolidayPeriodService // Añadir el servicio de recesos personalizados
  ) {}

  async calculateVacationDays(carnetIdentidad: string, startDate: Date, endDate: Date): Promise<VacationResponse> {
    // Buscar usuario por CI en la base de datos local
    const user = await this.userService.findByCarnet(carnetIdentidad);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    // Consultar la API externa para obtener la información completa del usuario
    const apiUserData = await this.userService.verifyWithExternalApi(carnetIdentidad);
    if (!apiUserData) {
      throw new BadRequestException('Información del usuario no encontrada en la API externa.');
    }

    const userData = apiUserData.attributes; // Extrae los datos necesarios del objeto API

    // Convertir fechas para cálculos
    const userDate = DateTime.fromISO(userData.fecha_ingreso);
    const startDateTime = DateTime.fromJSDate(startDate).startOf('day');
    const endDateTime = DateTime.fromJSDate(endDate).endOf('day');

    // Calcular antigüedad y días de vacaciones
    const yearsOfService = this.vacationCalculatorService.calculateYearsOfService(userDate, endDateTime);
    const monthsOfService = this.vacationCalculatorService.calculateMonthsOfService(userDate, endDateTime);
    const daysOfService = this.vacationCalculatorService.calculateDaysOfService(userDate, endDateTime);
    const vacationDays = this.vacationCalculatorService.calculateVacationDays(yearsOfService);

    // Obtener recesos generales y días no hábiles
    const { holidayPeriods } = await this.recesoService.getHolidayPeriods(startDateTime.year);
    const nonHolidayDays = await this.nonHolidayService.getNonHolidayDays(startDateTime.year);

    // Obtener recesos personalizados del usuario
    const personalizedRecesses = await this.userHolidayPeriodService.getUserHolidayPeriods(user.id, startDateTime.year);

    const recesos = [];
    let totalNonHolidayDays = 0;
    const nonHolidayDetails = [];

    // Procesar recesos, priorizando personalizados sobre generales
    for (const period of holidayPeriods) {
      const personalizedReceso = personalizedRecesses.find(p => p.name === period.name); // Buscar receso personalizado con el mismo nombre
      const effectiveReceso = personalizedReceso || period; // Priorizar receso personalizado si existe

      const startDateHol = DateTime.fromJSDate(effectiveReceso.startDate).startOf('day');
      const endDateHol = DateTime.fromJSDate(effectiveReceso.endDate).endOf('day');

      const totalDays = this.vacationCalculatorService.countWeekdays(startDateHol, endDateHol);
      const nonHolidayDaysCount = this.vacationCalculatorService.getIntersectionDays(startDateHol, endDateHol, nonHolidayDays);

      totalNonHolidayDays += nonHolidayDaysCount;

      nonHolidayDays.forEach(nonHoliday => {
        const nonHolidayDate = DateTime.fromISO(nonHoliday.date).startOf('day');
        if (nonHolidayDate >= startDateHol && nonHolidayDate <= endDateHol) {
          nonHolidayDetails.push({
            date: nonHoliday.date,
            reason: `Dentro del receso ${personalizedReceso ? 'personalizado' : 'general'} ${effectiveReceso.name}`
          });
        }
      });

      recesos.push({
        name: effectiveReceso.name,
        startDate: effectiveReceso.startDate,
        endDate: effectiveReceso.endDate,
        totalDays: totalDays,
        nonHolidayDays: nonHolidayDaysCount,
        daysCount: totalDays - nonHolidayDaysCount,
        type: personalizedReceso ? 'personalizado' : 'general' // Campo adicional para indicar tipo de receso
      });
    }

    const totalVacationDaysUsed = recesos.reduce((total, receso) => total + receso.daysCount, 0);
    const remainingVacationDays = vacationDays - totalVacationDaysUsed;

    return {
      carnetIdentidad: user.ci,
      name: userData.nombres,
      email: userData.correo_electronico,
      position: userData.profesion,
      fechaIngreso: new Date(userData.fecha_ingreso),
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
