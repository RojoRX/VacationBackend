import { BadRequestException, Injectable } from '@nestjs/common';
import { UserService } from 'src/services/user.service';
import { NonHolidayService } from './nonholiday.service';
import { VacationResponse } from 'src/interfaces/vacation-response.interface';
import { VacationCalculatorService } from 'src/services/vacation-calculator.service';
import { RecesoService } from './receso.service';
import { UserHolidayPeriodService } from './userholidayperiod.service';
import { LicenseService } from './license.service';
import { DateTime } from 'luxon';
import { VacationRequestService } from './vacation_request.service';

@Injectable()
export class VacationService {
  constructor(
    private readonly userService: UserService,
    private readonly vacationCalculatorService: VacationCalculatorService,
    private readonly nonHolidayService: NonHolidayService,
    private readonly recesoService: RecesoService,
    private readonly userHolidayPeriodService: UserHolidayPeriodService,
    private readonly licenseService: LicenseService,
    private readonly vacationRequestService: VacationRequestService,
  ) {}

  async calculateVacationDays(carnetIdentidad: string, startDate: Date, endDate: Date): Promise<VacationResponse> {
    // Obtener datos del usuario
    const userData = await this.userService.getUserData(carnetIdentidad);
    if (!userData) {
      throw new BadRequestException('Usuario no encontrado.');
    }
  
    // Convertir fechas para cálculos
    const userDate = DateTime.fromISO(userData.fecha_ingreso);
    const startDateTime = DateTime.fromJSDate(startDate);
    const endDateTime = DateTime.fromJSDate(endDate);
  
    // Calcular antigüedad y días de vacaciones
    const yearsOfService = this.vacationCalculatorService.calculateYearsOfService(userDate, endDateTime);
    const vacationDays = this.vacationCalculatorService.calculateVacationDays(yearsOfService);
  
    // Extraer los años de startDate y endDate
    const startYear = startDateTime.year;
    const endYear = endDateTime.year;
  
    // Obtener recesos generales y días no hábiles
    const { holidayPeriods } = await this.recesoService.getHolidayPeriods(startYear);
    const nonHolidayDays = await this.nonHolidayService.getNonHolidayDays(startYear);
  
    // Obtener recesos personalizados del usuario
    const personalizedRecesses = await this.userHolidayPeriodService.getUserHolidayPeriods(userData.id, startYear);
  
    const recesos = [];
    let totalNonHolidayDays = 0;
    const nonHolidayDaysDetails = [];
  
    // Procesar recesos
    for (const period of holidayPeriods) {
      const personalizedReceso = personalizedRecesses.find(p => p.name === period.name) || period;
  
      const startDateHol = DateTime.fromJSDate(personalizedReceso.startDate).startOf('day');
      const endDateHol = DateTime.fromJSDate(personalizedReceso.endDate).endOf('day');
  
      const totalDays = this.vacationCalculatorService.countWeekdays(startDateHol, endDateHol);
      const nonHolidayDaysCount = this.vacationCalculatorService.getIntersectionDays(startDateHol, endDateHol, nonHolidayDays);
  
      totalNonHolidayDays += nonHolidayDaysCount;
  
      nonHolidayDays.forEach(nonHoliday => {
        const nonHolidayDate = DateTime.fromISO(nonHoliday.date).startOf('day');
        if (nonHolidayDate >= startDateHol && nonHolidayDate <= endDateHol) {
          nonHolidayDaysDetails.push({
            date: nonHoliday.date,
            reason: `Dentro del receso ${personalizedReceso.name}`
          });
        }
      });
  
      recesos.push({
        name: personalizedReceso.name,
        startDate: personalizedReceso.startDate,
        endDate: personalizedReceso.endDate,
        totalDays,
        nonHolidayDays: nonHolidayDaysCount,
        daysCount: totalDays - nonHolidayDaysCount,
        type: personalizedReceso === period ? 'general' : 'personalizado'
      });
    }
  
    const totalVacationDaysUsed = recesos.reduce((total, receso) => total + receso.daysCount, 0);
    let remainingVacationDays = vacationDays - totalVacationDaysUsed;
  
    // Consultar licencias autorizadas para el usuario
    const { totalAuthorizedDays: totalAuthorizedLicenseDays, requests: licenseRequests } = await this.licenseService.getTotalAuthorizedLicensesForUser(userData.id, startDate, endDate);
    
    // Consultar las solicitudes de vacaciones en el rango de fechas
    const { totalAuthorizedVacationDays, requests: vacationRequests } = await this.vacationRequestService.countAuthorizedVacationDaysInRange(carnetIdentidad, startDate.toISOString(), endDate.toISOString());

    console.log('Días de vacaciones autorizados:', totalAuthorizedVacationDays);
    console.log('Solicitudes de vacaciones autorizadas:', vacationRequests);
    // Restar los días de licencias y solicitudes autorizadas de las vacaciones restantes
    remainingVacationDays -= (totalAuthorizedLicenseDays + totalAuthorizedVacationDays);
  
    return {
      carnetIdentidad: userData.carnetIdentidad,
      name: userData.nombres,
      email: userData.correo_electronico,
      position: userData.profesion,
      fechaIngreso: new Date(userData.fecha_ingreso),
      antiguedadEnAnios: Math.floor(yearsOfService),
      antiguedadEnMeses: Math.floor(this.vacationCalculatorService.calculateMonthsOfService(userDate, endDateTime)),
      antiguedadEnDias: Math.floor(this.vacationCalculatorService.calculateDaysOfService(userDate, endDateTime)),
      diasDeVacacion: vacationDays,
      diasDeVacacionRestantes: remainingVacationDays,
      recesos,
      diasNoHabiles: totalNonHolidayDays,
      nonHolidayDaysDetails,
      licenciasAutorizadas: {
        totalAuthorizedDays: totalAuthorizedLicenseDays,
        requests: licenseRequests
      },
      solicitudesDeVacacionAutorizadas: {
        totalAuthorizedVacationDays,
        requests: vacationRequests
      }
    };
  }
  /**
   * Método para calcular el período de vacaciones usando la fecha de ingreso del usuario ajustada al año actual.
   * Solo requiere el CI del usuario.
   */
  async calculateVacationPeriodByCI(ci: string): Promise<VacationResponse> {
    // Paso 1: Buscar el usuario por CI
    const user = await this.userService.findByCarnet(ci);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    // Paso 2: Obtener la fecha de ingreso
    const fechaIngreso = DateTime.fromISO(user.fecha_ingreso); // Suponiendo que la fecha de ingreso es un string en formato ISO

    // Paso 3: Ajustar la fecha de ingreso al año actual
    const currentYear = DateTime.now().year;
    const startDate = fechaIngreso.set({ year: currentYear }).startOf('day'); // Mismo día/mes pero del año actual

    // Paso 4: Calcular el endDate (un día antes de que se cumpla el siguiente año desde startDate)
    const endDate = startDate.plus({ year: 1 }).minus({ day: 1 });

    // Paso 5: Reusar el método calculateVacationDays, pasándole el startDate y endDate calculados
    const vacationResponse = await this.calculateVacationDays(ci, startDate.toJSDate(), endDate.toJSDate());
    // Retornar la respuesta final con los datos de vacaciones
    return vacationResponse;
  }
}