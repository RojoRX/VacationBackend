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

    async calculateVacationDays(
        carnetIdentidad: string,
        startDate: Date,
        endDate: Date
    ): Promise<VacationResponse> {
        // Obtener datos del usuario
        const userData = await this.userService.getUserData(carnetIdentidad);
        if (!userData) {
            throw new BadRequestException('Usuario no encontrado.');
        }

        // Convertir fechas para cálculos
        const userDate = DateTime.fromISO(userData.fecha_ingreso, { zone: "utc" });
        const startDateTime = DateTime.fromJSDate(startDate, { zone: "utc" });
        const endDateTime = DateTime.fromJSDate(endDate, { zone: "utc" });

        // Depuración: Mostrar fechas clave
        console.log(`[Depuración - calculateVacationDays] Fecha de ingreso: ${userDate.toISO()}`);
        console.log(`[Depuración - calculateVacationDays] Fecha de inicio: ${startDateTime.toISO()}`);
        console.log(`[Depuración - calculateVacationDays] Fecha de fin: ${endDateTime.toISO()}`);

        // Calcular antigüedad
        const yearsOfService = this.vacationCalculatorService.calculateYearsOfService(userDate, endDateTime);
        console.log(`[Depuración - calculateVacationDays] Antigüedad en años: ${yearsOfService}`);

        // Calcular días de vacaciones
        const vacationDays = await this.vacationCalculatorService.calculateVacationDays(yearsOfService);
        console.log(`[Depuración - calculateVacationDays] Días de vacaciones calculados: ${vacationDays}`);

        // Extraer el año de startDate
        const year = startDateTime.year;
        console.log(`[Depuración - calculateVacationDays] Año para recesos y días no hábiles: ${year}`);

        // Obtener recesos generales y días no hábiles
        const { holidayPeriods } = await this.recesoService.getHolidayPeriods(year);
        const nonHolidayDays = await this.nonHolidayService.getNonHolidayDays(year);

        // Obtener recesos personalizados del usuario
        const personalizedRecesses = await this.userHolidayPeriodService.getUserHolidayPeriods(userData.id, year);

        // Determinar los recesos a utilizar
        const recesos = [];
        let totalNonHolidayDays = 0;
        const nonHolidayDaysDetails = [];

        // Combinar recesos generales y personalizados
        const allRecessesMap = new Map<string, any>();
        for (const generalRecess of holidayPeriods) {
            allRecessesMap.set(generalRecess.name.trim().toLowerCase(), generalRecess);
        }
        for (const personalizedRecess of personalizedRecesses) {
            allRecessesMap.set(personalizedRecess.name.trim().toLowerCase(), personalizedRecess);
        }

        // Procesar recesos
        const finalRecesses = Array.from(allRecessesMap.values());
        for (const receso of finalRecesses) {
            // Ajustar las fechas de inicio y fin para ignorar horas y zonas horarias
            const startDateHol = DateTime.fromJSDate(receso.startDate, { zone: "utc" }).startOf('day');
            const endDateHol = DateTime.fromJSDate(receso.endDate, { zone: "utc" }).endOf('day');

            console.log(`[Depuración] Procesando receso: ${receso.name}`);
            console.log(`[Depuración] Fecha de inicio (ajustada): ${startDateHol.toISO()}`);
            console.log(`[Depuración] Fecha de fin (ajustada): ${endDateHol.toISO()}`);

            // Calcular días hábiles en el rango (inclusive)
            const totalDays = this.vacationCalculatorService.countWeekdays(startDateHol, endDateHol);
            console.log(`[Depuración] Días hábiles totales en el receso: ${totalDays}`);

            // Calcular días no hábiles dentro del receso
            const nonHolidayDaysCount = this.vacationCalculatorService.getIntersectionDays(startDateHol, endDateHol, nonHolidayDays);
            totalNonHolidayDays += nonHolidayDaysCount;

            // Verificar días no hábiles dentro del receso
            nonHolidayDays.forEach(nonHoliday => {
                const nonHolidayDate = DateTime.fromISO(nonHoliday.date, { zone: "utc" }).startOf('day');
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

            console.log(`[Depuración] Días hábiles finales en el receso: ${totalDays - nonHolidayDaysCount}`);
        }

        // Calcular los días usados por recesos
        const totalVacationDaysUsed = recesos.reduce((total, receso) => total + receso.daysCount, 0);
        console.log(`[Depuración - calculateVacationDays] Días usados por recesos: ${totalVacationDaysUsed}`);

        // Consultar licencias autorizadas para el usuario
        const { totalAuthorizedDays: totalAuthorizedLicenseDays, requests: licenseRequests } = await this.licenseService.getTotalAuthorizedLicensesForUser(userData.id, startDate, endDate);
        console.log(`[Depuración - calculateVacationDays] Días de licencias autorizadas: ${totalAuthorizedLicenseDays}`);

        // Consultar las solicitudes de vacaciones en el rango de fechas
        const { totalAuthorizedVacationDays, requests: vacationRequests } = await this.vacationRequestService.countAuthorizedVacationDaysInRange(carnetIdentidad, startDate.toISOString(), endDate.toISOString());
        console.log(`[Depuración - calculateVacationDays] Días de vacaciones autorizadas: ${totalAuthorizedVacationDays}`);

        // Calcular el total de días usados (recesos + licencias + vacaciones autorizadas)
        const totalUsedDays = totalVacationDaysUsed + totalAuthorizedLicenseDays + totalAuthorizedVacationDays;
        console.log(`[Depuración - calculateVacationDays] Total de días usados: ${totalUsedDays}`);

        // Calcular los días de vacaciones restantes
        let remainingVacationDays = vacationDays - totalUsedDays ;
        console.log(`[Depuración - calculateVacationDays] Días de vacaciones restantes: ${remainingVacationDays}`);
        
        

        // Calcular la deuda si los días restantes son negativos
        let deuda = 0;
        if (remainingVacationDays < 0) {
            deuda = Math.abs(remainingVacationDays);
            remainingVacationDays = 0;  // Evitar que los días disponibles sean negativos
        }
        console.log(`[Depuración - calculateVacationDays] Deuda calculada: ${deuda}`);

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

    async calculateAccumulatedDebt(
        carnetIdentidad: string,
        endDate: Date
    ): Promise<{ deudaAcumulativa: number; detalles: any[] }> {
        // Obtener datos del usuario
        const userData = await this.userService.getUserData(carnetIdentidad);
        if (!userData) {
            throw new BadRequestException("Usuario no encontrado.");
        }
    
        // Convertir la fecha de ingreso a DateTime y asegurarse de que esté en UTC
        const fechaIngreso = DateTime.fromISO(userData.fecha_ingreso, { zone: "utc" });
        const endDateTime = DateTime.fromJSDate(endDate, { zone: "utc" });
    
        // Validar que la fecha de ingreso sea válida
        if (!fechaIngreso.isValid) {
            throw new Error(`Fecha de ingreso inválida: ${userData.fecha_ingreso}`);
        }
    
/*         // Depuración: Mostrar fechas clave
        console.log(`[Depuración] Fecha de ingreso del usuario: ${fechaIngreso.toISO()}`);
        console.log(`[Depuración] Fecha límite para el cálculo: ${endDateTime.toISO()}`);
     */
        // Inicializar valores
        let deudaAcumulativa = 0;
        const detalles = [];
    
        // Iterar sobre cada gestión (período de un año)
        let currentStartDate = fechaIngreso;
        while (currentStartDate < endDateTime) {
            // Definir el endDate de la gestión actual (un año después de currentStartDate)
            const currentEndDate = currentStartDate.plus({ year: 1 });
    
            // Ajustar el endDate si excede la fecha límite (endDateTime)
            const adjustedEndDate = currentEndDate > endDateTime ? endDateTime : currentEndDate;
    
            // Depuración: Mostrar el período que se está calculando
            console.log(`[Depuración] Calculando período: ${currentStartDate.toISO()} - ${adjustedEndDate.toISO()}`);
    
            try {
                // Guardar la deuda acumulativa antes de actualizarla
                const deudaAcumulativaAnterior = deudaAcumulativa;
    
                // Calcular la deuda para la gestión actual
                const result = await this.calculateVacationDays(
                    carnetIdentidad,
                    currentStartDate.toJSDate(),
                    adjustedEndDate.toJSDate()
                );
    
/*                 // Depuración: Mostrar los resultados de calculateVacationDays
                console.log(`[Depuración] Resultados para el período:`);
                console.log(`- Días de vacaciones: ${result.diasDeVacacion}`);
                console.log(`- Días restantes: ${result.diasDeVacacionRestantes}`);
                console.log(`- Deuda calculada: ${result.deuda}`);
     */
                // Acumular la deuda de la gestión actual
                deudaAcumulativa += result.deuda || 0;
    
                // Si hay días de vacaciones restantes positivos, reducir la deuda acumulada
                if (result.diasDeVacacionRestantes > 0) {
                    deudaAcumulativa = Math.max(0, deudaAcumulativa - result.diasDeVacacionRestantes);
                }
    
                // Calcular los días disponibles de vacaciones para la siguiente gestión
                const diasDisponibles = Math.max(0, result.diasDeVacacionRestantes - deudaAcumulativaAnterior);
    
                // Guardar los detalles de la gestión actual
                detalles.push({
                    startDate: currentStartDate.toJSDate(),
                    endDate: adjustedEndDate.toJSDate(),
                    deuda: result.deuda,
                    diasDeVacacion: result.diasDeVacacion,
                    diasDeVacacionRestantes: result.diasDeVacacionRestantes,
                    deudaAcumulativaHastaEstaGestion: deudaAcumulativa, // Deuda acumulada hasta esta gestión
                    deudaAcumulativaAnterior: deudaAcumulativaAnterior, // Deuda acumulada de la gestión anterior
                    diasDisponibles: diasDisponibles, // Días disponibles para la siguiente gestión
                });
            } catch (error) {
                // Depuración: Mostrar errores si ocurren
                //console.error(`[Depuración] Error calculando deuda para el período ${currentStartDate.toISO()} - ${adjustedEndDate.toISO()}:`, error);
            }
    
            // Depuración: Mostrar el avance de currentStartDate
            //console.log(`[Depuración] Antes de avanzar: ${currentStartDate.toISO()}`);
            currentStartDate = currentStartDate.plus({ year: 1 });
            //console.log(`[Depuración] Después de avanzar: ${currentStartDate.toISO()}`);
        }
    
        // Depuración: Mostrar la deuda acumulativa y los detalles finales
        //console.log(`[Depuración] Deuda acumulativa total: ${deudaAcumulativa}`);
        //console.log(`[Depuración] Detalles de las gestiones:`, detalles);
    
        return { deudaAcumulativa, detalles };
    }
    



}