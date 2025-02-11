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
    ) { }

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
        const vacationDays = await this.vacationCalculatorService.calculateVacationDays(yearsOfService);

        // Extraer el año de startDate
        const year = startDateTime.year;

        // Obtener recesos generales y días no hábiles
        const { holidayPeriods } = await this.recesoService.getHolidayPeriods(year);
        const nonHolidayDays = await this.nonHolidayService.getNonHolidayDays(year);

        // Obtener recesos personalizados del usuario
        const personalizedRecesses = await this.userHolidayPeriodService.getUserHolidayPeriods(userData.id, year);

        // Determinar los recesos a utilizar 
        const recesos = [];
        let totalNonHolidayDays = 0;
        const nonHolidayDaysDetails = [];

        // Si no hay recesos generales, usa los personalizados
        const periodsToProcess = holidayPeriods.length > 0 ? holidayPeriods : personalizedRecesses;

        for (const period of periodsToProcess) {
            // Verifica si existe un receso personalizado con el mismo nombre (solo si hay recesos generales)
            const personalizedReceso = personalizedRecesses.find(p => p.name.trim().toLowerCase() === period.name.trim().toLowerCase());

            // Si hay recesos generales, prioriza el personalizado si existe
            const recesoFinal = personalizedReceso || period;

            // Si no hay recesos generales y ya estamos procesando los personalizados, asegúrate de que los campos existan
            const startDateHol = DateTime.fromJSDate(recesoFinal.startDate).startOf('day');
            const endDateHol = DateTime.fromJSDate(recesoFinal.endDate).endOf('day');

            const totalDays = this.vacationCalculatorService.countWeekdays(startDateHol, endDateHol);
            const nonHolidayDaysCount = this.vacationCalculatorService.getIntersectionDays(startDateHol, endDateHol, nonHolidayDays);
            totalNonHolidayDays += nonHolidayDaysCount;

            // Verificar días no hábiles dentro del receso
            nonHolidayDays.forEach(nonHoliday => {
                const nonHolidayDate = DateTime.fromISO(nonHoliday.date).startOf('day');
                if (nonHolidayDate >= startDateHol && nonHolidayDate <= endDateHol) {
                    nonHolidayDaysDetails.push({
                        date: nonHoliday.date,
                        reason: `Dentro del receso ${recesoFinal.name}`
                    });
                }
            });

            // Agregar el receso al array de recesos
            recesos.push({
                name: recesoFinal.name,
                startDate: recesoFinal.startDate,
                endDate: recesoFinal.endDate,
                totalDays,
                nonHolidayDays: nonHolidayDaysCount,
                daysCount: totalDays - nonHolidayDaysCount,
                type: personalizedReceso ? 'personalizado' : (holidayPeriods.length > 0 ? 'general' : 'personalizado')
            });
        }
        // Calcular los días usados por recesos
        const totalVacationDaysUsed = recesos.reduce((total, receso) => total + receso.daysCount, 0);

        // Consultar licencias autorizadas para el usuario
        const { totalAuthorizedDays: totalAuthorizedLicenseDays, requests: licenseRequests } = await this.licenseService.getTotalAuthorizedLicensesForUser(userData.id, startDate, endDate);

        // Consultar las solicitudes de vacaciones en el rango de fechas
        const { totalAuthorizedVacationDays, requests: vacationRequests } = await this.vacationRequestService.countAuthorizedVacationDaysInRange(carnetIdentidad, startDate.toISOString(), endDate.toISOString());

        // Calcular el total de días usados (recesos + licencias + vacaciones autorizadas)
        const totalUsedDays = totalVacationDaysUsed + totalAuthorizedLicenseDays + totalAuthorizedVacationDays;

        // Calcular los días de vacaciones restantes
        let remainingVacationDays = vacationDays - totalUsedDays;

        // Calcular la deuda si los días restantes son negativos
        let deuda = 0;
        if (remainingVacationDays < 0) {
            deuda = Math.abs(remainingVacationDays);
            remainingVacationDays = 0;  // Evitar que los días disponibles sean negativos
        }

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
            deuda,
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
        // Buscar el usuario por CI
        const user = await this.userService.findByCarnet(ci);
        if (!user) {
            throw new BadRequestException('Usuario no encontrado.');
        }

        // Obtener la fecha de ingreso
        const fechaIngreso = DateTime.fromISO(user.fecha_ingreso);

        // Ajustar la fecha de ingreso al año actual
        const currentYear = DateTime.now().year;
        const startDate = fechaIngreso.set({ year: currentYear }).startOf('day');

        // Calcular el endDate (un día antes de que se cumpla el siguiente año desde startDate)
        const endDate = startDate.plus({ year: 1 }).minus({ day: 1 });

        // Reusar el método calculateVacationDays
        return this.calculateVacationDays(ci, startDate.toJSDate(), endDate.toJSDate());
    }

}