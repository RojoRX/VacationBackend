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
        //console.log("Recesos personalizados obtenidos:", personalizedRecesses);

        // Determinar los recesos a utilizar
        const recesos = [];
        let totalNonHolidayDays = 0;
        const nonHolidayDaysDetails = [];

        // Si existen recesos personalizados, usarlos completamente o combinarlos con los generales
        const allRecessesMap = new Map<string, any>();

        // Agregar recesos generales al mapa (clave: nombre en minúsculas)
        for (const generalRecess of holidayPeriods) {
            allRecessesMap.set(generalRecess.name.trim().toLowerCase(), generalRecess);
        }

        // Agregar o sobrescribir con recesos personalizados
        for (const personalizedRecess of personalizedRecesses) {
            allRecessesMap.set(personalizedRecess.name.trim().toLowerCase(), personalizedRecess);
        }

        // Convertir el mapa de vuelta a un array con los recesos finales
        const finalRecesses = Array.from(allRecessesMap.values());
        //console.log("Recesos finales a procesar:", finalRecesses);

        for (const receso of finalRecesses) {
            //console.log("Procesando receso:", receso.name);

            // Definir fechas del receso
            const startDateHol = DateTime.fromJSDate(receso.startDate).startOf('day');
            const endDateHol = DateTime.fromJSDate(receso.endDate).endOf('day');

            const totalDays = this.vacationCalculatorService.countWeekdays(startDateHol, endDateHol);
            const nonHolidayDaysCount = this.vacationCalculatorService.getIntersectionDays(startDateHol, endDateHol, nonHolidayDays);
            totalNonHolidayDays += nonHolidayDaysCount;

            // Verificar días no hábiles dentro del receso
            nonHolidayDays.forEach(nonHoliday => {
                const nonHolidayDate = DateTime.fromISO(nonHoliday.date).startOf('day');
                if (nonHolidayDate >= startDateHol && nonHolidayDate <= endDateHol) {
                    nonHolidayDaysDetails.push({
                        date: nonHoliday.date,
                        reason: `Dentro del receso ${receso.name}`
                    });
                }
            });

            // Determinar tipo de receso
            const isPersonalized = personalizedRecesses.some(p => p.name.trim().toLowerCase() === receso.name.trim().toLowerCase());

            recesos.push({
                name: receso.name,
                startDate: receso.startDate,
                endDate: receso.endDate,
                totalDays,
                nonHolidayDays: nonHolidayDaysCount,
                daysCount: totalDays - nonHolidayDaysCount,
                type: isPersonalized ? 'personalizado' : 'general'
            });
        }

        //console.log("Recesos finales procesados:", recesos);


        // Ver el resultado final de los recesos procesados
       // console.log("Recesos procesados:", recesos);

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
        console.log(` Recibi esta fecha ${startDate} y ${endDate} `)

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