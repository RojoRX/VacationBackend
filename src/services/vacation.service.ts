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
import ResumenGeneral from 'src/interfaces/resumen-general.interface';
import { formatToSimpleDate, parseToStartOfDay } from 'src/utils/dateUtils';
import { adjustPeriodEnd, isValidPeriod } from 'src/utils/date.helpers';
import { SystemConfigService } from 'src/config/system-config.service';

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
    private readonly systemConfigService: SystemConfigService,
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


    // Calcular antigüedad
    const yearsOfService = this.vacationCalculatorService.calculateYearsOfService(userDate, endDateTime);


    // Calcular días de vacaciones
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
      const endDateHol = DateTime.fromJSDate(receso.endDate, { zone: "utc" }).startOf('day');

      // Calcular días hábiles en el rango (inclusive)
      const totalDays = this.vacationCalculatorService.countWeekdays(
        startDateHol,
        endDateHol
      );
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

  async calculateAccumulatedDebt(
    carnetIdentidad: string,
    endDate: Date | string
  ): Promise<{
    deudaAcumulativa: number;
    detalles: any[];
    resumenGeneral: ResumenGeneral;
  }> {
    console.log("Fecha Recibida" + endDate)
    const userData = await this.userService.getUserData(carnetIdentidad);
    if (!userData) {
      throw new BadRequestException("Usuario no encontrado.");
    }
    // Función de normalización robusta
    const normalizeDate = (dateInput: Date | string): DateTime => {
      try {
        // Si es string, intentar parsear en varios formatos
        if (typeof dateInput === 'string') {
          // Intento 1: Formato ISO (YYYY-MM-DD)
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return DateTime.fromFormat(dateInput, 'yyyy-MM-dd', { zone: 'utc' }).startOf('day');
          }

          // Intento 2: Formato ISO con tiempo
          const isoDate = DateTime.fromISO(dateInput, { zone: 'utc' });
          if (isoDate.isValid) {
            return isoDate.startOf('day');
          }

          // Intento 3: Otros formatos comunes
          const formats = [
            'yyyy/MM/dd',
            'MM/dd/yyyy',
            'dd-MM-yyyy',
            'yyyy.MM.dd'
          ];

          for (const format of formats) {
            const parsed = DateTime.fromFormat(dateInput, format, { zone: 'utc' });
            if (parsed.isValid) {
              return parsed.startOf('day');
            }
          }
        }

        // Si es objeto Date o los intentos anteriores fallaron
        const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        const dateTime = DateTime.fromJSDate(dateObj, { zone: 'utc' }).startOf('day');

        if (!dateTime.isValid) {
          throw new Error('Fecha inválida');
        }

        return dateTime;
      } catch (error) {
        throw new BadRequestException(`Formato de fecha inválido: ${dateInput}`);
      }
    };

    // Normalizar fechas
    const parsedEndDate = normalizeDate(endDate);
    const fechaIngreso = normalizeDate(userData.fecha_ingreso);

    console.log("Fecha Final Normalizada:", parsedEndDate.toISODate());
    console.log("Fecha de Ingreso Normalizada:", fechaIngreso.toISODate());


    let deudaAcumulativa = 0;
    const detalles = [];

    // Obtener configuración general del sistema (si existe)
    // Obtener configuración general del sistema (si existe)
    const systemConfig = await this.systemConfigService.getStartCountingYear(); // Ej: { year: 2015 } o null

    // Determinar fecha de inicio del cálculo
    let currentStartDate: DateTime;

    if (systemConfig?.year) {
      currentStartDate = DateTime.fromObject({
        year: systemConfig.year,
        month: fechaIngreso.month,
        day: fechaIngreso.day
      }, { zone: 'utc' });

      console.log(`📆 Inicio de conteo desde configuración global (solo cambia el año): ${currentStartDate.toISODate()}`);
    } else {
      currentStartDate = fechaIngreso;
      console.log(`📆 Inicio de conteo usando fecha de ingreso del usuario: ${currentStartDate.toISODate()}`);
    }


    while (currentStartDate < parsedEndDate) {
      const currentEndDate = currentStartDate.plus({ years: 1 });
      const adjustedEndDate = currentEndDate > parsedEndDate ? parsedEndDate : currentEndDate;

      const diffInMonths = adjustedEndDate.diff(currentStartDate, 'months').months;
      if (diffInMonths < 12) break;

      try {
        const deudaAcumulativaAnterior = deudaAcumulativa;

        const result = await this.calculateVacationDays(
          carnetIdentidad,
          currentStartDate.toJSDate(),
          adjustedEndDate.toJSDate()
        );

        deudaAcumulativa += result.deuda || 0;

        if (result.diasDeVacacionRestantes > 0) {
          deudaAcumulativa = Math.max(0, deudaAcumulativa - result.diasDeVacacionRestantes);
        }

        const diasDisponibles = Math.max(0, result.diasDeVacacionRestantes - deudaAcumulativaAnterior);

        detalles.push({
          startDate: currentStartDate.toJSDate(),
          endDate: adjustedEndDate.toJSDate(),
          deuda: result.deuda,
          diasDeVacacion: result.diasDeVacacion,
          diasDeVacacionRestantes: result.diasDeVacacionRestantes,
          deudaAcumulativaHastaEstaGestion: deudaAcumulativa,
          deudaAcumulativaAnterior: deudaAcumulativaAnterior,
          diasDisponibles: diasDisponibles,
        });
      } catch (error) {
        console.error(`Error calculando deuda para el período ${currentStartDate.toISODate()} - ${adjustedEndDate.toISODate()}:`, error);
      }

      currentStartDate = currentStartDate.plus({ years: 1 });
    }

    const gestionesConDeuda = detalles.filter(d => d.deuda > 0).length;
    const gestionesSinDeuda = detalles.length - gestionesConDeuda;
    const promedioDeuda = detalles.length > 0 ?
      detalles.reduce((sum, d) => sum + d.deuda, 0) / detalles.length : 0;

    const resumenGeneral: ResumenGeneral = {
      deudaTotal: deudaAcumulativa,
      diasDisponiblesActuales: detalles.reduce((sum, d) => sum + (d.diasDisponibles || 0), 0),
      gestionesConDeuda,
      gestionesSinDeuda,
      promedioDeudaPorGestion: promedioDeuda,
      primeraGestion: detalles[0]?.startDate || null,
      ultimaGestion: detalles[detalles.length - 1]?.endDate || null,
    };

    return {
      deudaAcumulativa,
      detalles,
      resumenGeneral
    };
  }

  async calculateDebtSinceDate(
    carnetIdentidad: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    deudaAcumulativa: number;
    detalles: any[];
    resumenGeneral: ResumenGeneral;
  }> {
    // Obtener datos del usuario
    const userData = await this.userService.getUserData(carnetIdentidad);
    if (!userData) {
      throw new BadRequestException("Usuario no encontrado.");
    }

    // Convertir fechas a DateTime (Luxon)
    const fechaIngreso = DateTime.fromISO(userData.fecha_ingreso, { zone: "utc" });
    const startDateTime = DateTime.fromJSDate(startDate, { zone: "utc" });
    const endDateTime = DateTime.fromJSDate(endDate, { zone: "utc" });
    const now = DateTime.utc(); // Fecha actual en UTC

    // Validar fechas
    if (!fechaIngreso.isValid) {
      throw new Error(`Fecha de ingreso inválida: ${userData.fecha_ingreso}`);
    }

    // Validar que la fecha de inicio no sea anterior a ingreso
    if (startDateTime < fechaIngreso) {
      throw new BadRequestException("La fecha de inicio no puede ser anterior a la fecha de ingreso.");
    }

    // Inicializar variables
    let deudaAcumulativa = 0;
    const detalles = [];

    // Calcular períodos anuales
    let currentStartDate = startDateTime;
    while (currentStartDate < endDateTime) {
      const currentEndDate = currentStartDate.plus({ year: 1 });
      const adjustedEndDate = currentEndDate > endDateTime ? endDateTime : currentEndDate;

      // No calcular períodos que comienzan en el futuro
      if (currentStartDate > now) {
        break;
      }

      try {
        const deudaAcumulativaAnterior = deudaAcumulativa;

        const result = await this.calculateVacationDays(
          carnetIdentidad,
          currentStartDate.toJSDate(),
          // Ajustar endDate para no superar la fecha actual
          adjustedEndDate > now ? now.toJSDate() : adjustedEndDate.toJSDate()
        );

        // Actualizar deuda acumulativa
        deudaAcumulativa += result.deuda || 0;

        // Ajustar deuda con días restantes
        if (result.diasDeVacacionRestantes > 0) {
          deudaAcumulativa = Math.max(0, deudaAcumulativa - result.diasDeVacacionRestantes);
        }

        // Calcular días disponibles
        const diasDisponibles = Math.max(0, result.diasDeVacacionRestantes - deudaAcumulativaAnterior);

        // Guardar detalles solo si el período no es completamente futuro
        if (adjustedEndDate <= now || currentStartDate <= now) {
          detalles.push({
            startDate: currentStartDate.toJSDate(),
            endDate: adjustedEndDate.toJSDate(),
            deuda: result.deuda,
            diasDeVacacion: result.diasDeVacacion,
            diasDeVacacionRestantes: result.diasDeVacacionRestantes,
            deudaAcumulativaHastaEstaGestion: deudaAcumulativa,
            deudaAcumulativaAnterior,
            diasDisponibles
          });
        }
      } catch (error) {
        console.error(`Error calculando deuda para ${currentStartDate.toISO()} - ${adjustedEndDate.toISO()}:`, error);
      }

      currentStartDate = currentStartDate.plus({ year: 1 });
    }

    // Calcular resumen general solo con períodos no futuros
    const periodosNoFuturos = detalles.filter(d =>
      DateTime.fromJSDate(d.endDate) <= now
    );

    const gestionesConDeuda = periodosNoFuturos.filter(d => d.deuda > 0).length;
    const gestionesSinDeuda = periodosNoFuturos.length - gestionesConDeuda;
    const promedioDeuda = periodosNoFuturos.length > 0
      ? periodosNoFuturos.reduce((sum, d) => sum + d.deuda, 0) / periodosNoFuturos.length
      : 0;

    const resumenGeneral: ResumenGeneral = {
      deudaTotal: deudaAcumulativa,
      diasDisponiblesActuales: periodosNoFuturos.reduce((sum, d) => sum + (d.diasDisponibles || 0), 0),
      gestionesConDeuda,
      gestionesSinDeuda,
      promedioDeudaPorGestion: promedioDeuda,
      primeraGestion: periodosNoFuturos[0]?.startDate || null,
      ultimaGestion: periodosNoFuturos[periodosNoFuturos.length - 1]?.endDate || null,
    };

    return {
      deudaAcumulativa,
      detalles: periodosNoFuturos, // Solo devolver períodos no futuros
      resumenGeneral
    };
  }



}