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
    console.log('Iniciando cálculo de días de vacaciones...');

    // Buscar usuario por CI en la base de datos local
    const user = await this.userService.findByCarnet(carnetIdentidad);
    if (!user) {
      console.log('Usuario no encontrado en la base de datos local.');
      throw new BadRequestException('Usuario no encontrado.');
    }
    console.log('Usuario encontrado:', user);

    // Consultar la API externa para obtener la información completa del usuario
    const apiUserData = await this.userService.verifyWithExternalApi(carnetIdentidad);
    if (!apiUserData) {
      console.log('Información del usuario no encontrada en la API externa.');
      throw new BadRequestException('Información del usuario no encontrada en la API externa.');
    }
    console.log('Datos del usuario obtenidos de la API:', apiUserData);

    const userData = apiUserData.attributes; // Extrae los datos necesarios del objeto API
    console.log('Datos extraídos del usuario:', userData);

    // Convertir fechas para cálculos
    try {
      // Convertir fechas para cálculos
      const userDate = DateTime.fromISO(userData.fecha_ingreso);
      const startDateTime = DateTime.fromJSDate(startDate).startOf('day');
      const endDateTime = DateTime.fromJSDate(endDate).endOf('day');
      console.log('Fechas convertidas - Fecha de ingreso:', userDate, 'Fecha de inicio:', startDateTime, 'Fecha de fin:', endDateTime);

      // Calcular antigüedad y días de vacaciones
      const yearsOfService = this.vacationCalculatorService.calculateYearsOfService(userDate, endDateTime);
      const monthsOfService = this.vacationCalculatorService.calculateMonthsOfService(userDate, endDateTime);
      const daysOfService = this.vacationCalculatorService.calculateDaysOfService(userDate, endDateTime);
      const vacationDays = this.vacationCalculatorService.calculateVacationDays(yearsOfService);
      console.log('Antigüedad calculada - Años:', yearsOfService, 'Meses:', monthsOfService, 'Días:', daysOfService, 'Días de vacaciones:', vacationDays);

      // Obtener recesos generales y días no hábiles
      const { generalHolidayPeriods } = await this.recesoService.getHolidayPeriods(startDateTime.toJSDate(), endDateTime.toJSDate());
      console.log('Recesos generales obtenidos:', generalHolidayPeriods);

      const nonHolidayDays = await this.nonHolidayService.getNonHolidayDays(startDateTime.year);
      console.log('Días no hábiles obtenidos:', nonHolidayDays);

      const recesos = [];
      let totalNonHolidayDays = 0;
      const nonHolidayDetails = [];

      // Procesar recesos generales
      for (const period of generalHolidayPeriods) {
        const startDateHol = DateTime.fromJSDate(period.startDate).startOf('day');
        const endDateHol = DateTime.fromJSDate(period.endDate).endOf('day');
        console.log('Procesando receso:', period.name, 'Fecha de inicio:', startDateHol, 'Fecha de fin:', endDateHol);

        const totalDays = this.vacationCalculatorService.countWeekdays(startDateHol.toJSDate(), endDateHol.toJSDate());
        const nonHolidayDaysCount = this.vacationCalculatorService.getIntersectionDays(startDateHol.toJSDate(), endDateHol.toJSDate(), nonHolidayDays);
        console.log('Total de días en receso:', totalDays, 'Días no hábiles en receso:', nonHolidayDaysCount);

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
          totalDays: totalDays,
          nonHolidayDays: nonHolidayDaysCount,
          daysCount: totalDays - nonHolidayDaysCount
        });
      }

      const totalVacationDaysUsed = recesos.reduce((total, receso) => total + receso.daysCount, 0);
      const remainingVacationDays = vacationDays - totalVacationDaysUsed;
      console.log('Días de vacaciones usados:', totalVacationDaysUsed, 'Días de vacaciones restantes:', remainingVacationDays);

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

    } catch (error) {
      console.error('Error en el cálculo de días de vacaciones:', error);
      throw new BadRequestException('Error en el cálculo de días de vacaciones.');
    }
  }
}
