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
import { UserConfigService } from './user-config.service';
import { AdministrativeHolidayPeriodService } from './administrative-holiday-period.service';
import { EmployeeContractHistoryService } from './employee-contract-history.service';

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
    private readonly userConfigService: UserConfigService,
    private readonly administrativeHolidayService: AdministrativeHolidayPeriodService,
    private readonly contractHistoryService: EmployeeContractHistoryService,
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

    console.log(`[calculateVacationDays] Calculando para CI: ${carnetIdentidad}`);
    console.log(`[calculateVacationDays] Rango de cálculo: ${startDateTime.toISODate()} a ${endDateTime.toISODate()}`);

    // Calcular antigüedad
    const yearsOfService = this.vacationCalculatorService.calculateYearsOfService(userDate, endDateTime);
    const vacationDays = await this.vacationCalculatorService.calculateVacationDays(yearsOfService);

    const year = startDateTime.year;

    // 🏖️ Obtener recesos según tipo de empleado
    let holidayPeriods = [];
    if (userData.tipoEmpleado === 'DOCENTE') {
      holidayPeriods = await this.recesoService.getHolidayPeriodsForPersonalYear(startDate, endDateTime.toJSDate());
      console.log(`[calculateVacationDays] Recesos generales aplicados (${holidayPeriods.length})`);
    } else if (userData.tipoEmpleado === 'ADMINISTRATIVO') {
      holidayPeriods = await this.administrativeHolidayService.getHolidayPeriodsForPersonalYear(startDate, endDateTime.toJSDate());
      console.log(`[calculateVacationDays] Recesos administrativos aplicados (${holidayPeriods.length})`);
    }

    const nonHolidayDays = await this.nonHolidayService.getNonHolidayDaysForRange(startDate, endDateTime.toJSDate());
    const personalizedRecesses = await this.userHolidayPeriodService.getUserHolidayPeriodsForPersonalYear(
      userData.id,
      startDate,
      endDateTime.toJSDate()
    );

    console.log(`[calculateVacationDays] Recesos personalizados: ${personalizedRecesses.length}`);

    // 🔹 Combinar recesos sin eliminar parciales
    // 🔹 Construcción de finalRecesses con reemplazo estricto por año y tipo
    const finalRecesses: any[] = [];

    // Primero, agrupar recesos personalizados por tipo y año laboral
    const personalizedMap = new Map<string, any>();
    personalizedRecesses.forEach(p => {
      const startYear = DateTime.fromJSDate(p.startDate).year;
      const key = `${p.name.trim().toLowerCase()}_${startYear}`;
      personalizedMap.set(key, p);
    });

    // Iterar recesos generales/administrativos
    for (const generalRecess of holidayPeriods) {
      const startYear = DateTime.fromJSDate(generalRecess.startDate).year;
      const key = `${generalRecess.name.trim().toLowerCase()}_${startYear}`;

      if (personalizedMap.has(key)) {
        // Existe un receso personalizado del mismo tipo y año → reemplazar
        finalRecesses.push(personalizedMap.get(key));
        // Eliminarlo del mapa para no agregarlo de nuevo más tarde
        personalizedMap.delete(key);
      } else {
        // No hay receso personalizado que lo reemplace → mantener general
        finalRecesses.push(generalRecess);
      }
    }

    // Agregar los recesos personalizados restantes (que no reemplazaron ningún general)
    personalizedMap.forEach(p => finalRecesses.push(p));



    // Procesar recesos para calcular días
    const recesos = [];
    let totalNonHolidayDays = 0;
    const nonHolidayDaysDetails = [];

    for (const receso of finalRecesses) {
      const isPersonalized = personalizedRecesses.some(p => p === receso);
      const recessType = isPersonalized ? 'personalizado' :
        (userData.tipoEmpleado === 'DOCENTE' ? 'general' : 'administrativo');

      const startDateHol = DateTime.fromJSDate(receso.startDate, { zone: "utc" }).startOf('day');
      const endDateHol = DateTime.fromJSDate(receso.endDate, { zone: "utc" }).endOf('day');

      // Días hábiles
      const totalDays = this.vacationCalculatorService.countWeekdays(startDateHol, endDateHol);

      // Días no hábiles
      const nonHolidayDaysCount = this.vacationCalculatorService.getIntersectionDays(startDateHol, endDateHol, nonHolidayDays);
      totalNonHolidayDays += nonHolidayDaysCount;

      nonHolidayDays.forEach(nonHoliday => {
        const nonHolidayDate = DateTime.fromISO(nonHoliday.date, { zone: "utc" }).startOf('day');
        if (nonHolidayDate >= startDateHol && nonHolidayDate <= endDateHol) {
          nonHolidayDaysDetails.push({
            date: nonHoliday.date,
            reason: `Dentro del receso ${nonHoliday.description}`
          });
        }
      });

      const daysCount = totalDays - nonHolidayDaysCount;

      recesos.push({
        name: receso.name,
        startDate: receso.startDate,
        endDate: receso.endDate,
        totalDays,
        nonHolidayDays: nonHolidayDaysCount,
        daysCount,
        type: recessType
      });
    }

    // 🧾 Total de días de receso
    const totalVacationDaysUsedByRecess = recesos.reduce((sum, r) => sum + r.daysCount, 0);

    // 📄 Licencias y vacaciones autorizadas
    const { totalAuthorizedDays: totalAuthorizedLicenseDays, requests: licenseRequests } =
      await this.licenseService.getTotalAuthorizedLicensesForUser(userData.id, startDate, endDate);

    const { totalAuthorizedVacationDays, requests: vacationRequests } =
      await this.vacationRequestService.countAuthorizedVacationDaysInRange(carnetIdentidad, startDate.toISOString(), endDate.toISOString());

    const totalUsedDays = totalVacationDaysUsedByRecess + totalAuthorizedLicenseDays + totalAuthorizedVacationDays;
    let remainingVacationDays = vacationDays - totalUsedDays;
    let deuda = 0;
    if (remainingVacationDays < 0) {
      deuda = Math.abs(remainingVacationDays);
      remainingVacationDays = 0;
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
  async calculateAccumulatedDebt(
    carnetIdentidad: string,
    endDate: Date | string
  ): Promise<{
    deudaAcumulativa: number;
    detalles: any[];
    resumenGeneral: ResumenGeneral;
  }> {
    const userData = await this.userService.getUserData(carnetIdentidad);
    if (!userData) throw new BadRequestException("Usuario no encontrado.");

    const normalizeDate = (dateInput: Date | string): DateTime => {
      if (typeof dateInput === 'string') {
        const isoDate = DateTime.fromISO(dateInput, { zone: 'utc' });
        if (isoDate.isValid) return isoDate.startOf('day');
        const formats = ['yyyy-MM-dd', 'yyyy/MM/dd', 'MM/dd/yyyy', 'dd-MM-yyyy', 'yyyy.MM.dd'];
        for (const f of formats) {
          const parsed = DateTime.fromFormat(dateInput, f, { zone: 'utc' });
          if (parsed.isValid) return parsed.startOf('day');
        }
      }
      return DateTime.fromJSDate(new Date(dateInput), { zone: 'utc' }).startOf('day');
    };

    const parsedEndDate = normalizeDate(endDate);
    const fechaIngreso = normalizeDate(userData.fecha_ingreso);

    let deudaAcumulativa = 0;
    let detalles: any[] = [];

    const contracts = await this.contractHistoryService.getContractsForUser(userData.id);
    const systemConfig = await this.systemConfigService.getStartCountingYear();
    const userConfig = await this.userConfigService.findByUserId(userData.id).catch(() => null);

    // -------------------------------------------------------
    // 🟦 DETERMINAR FECHA DE INICIO DE CONTABILIZACIÓN
    // -------------------------------------------------------
    let currentStartDate: DateTime;

    if (userConfig?.customStartYear) {
      currentStartDate = DateTime.fromObject({
        year: userConfig.customStartYear,
        month: fechaIngreso.month,
        day: fechaIngreso.day
      }, { zone: 'utc' });
    } else if (systemConfig?.year) {
      currentStartDate = DateTime.fromObject({
        year: systemConfig.year,
        month: fechaIngreso.month,
        day: fechaIngreso.day
      }, { zone: 'utc' });
    } else {
      currentStartDate = fechaIngreso;
    }

    // -------------------------------------------------------
    // 🟥 APLICAR DEUDA INICIAL COMO DEUDA ACUMULATIVA REAL
    // -------------------------------------------------------
    let deudaInicial = userConfig?.initialVacationBalance ?? 0;

    deudaAcumulativa = deudaInicial;

    let isFirstGestion = true;

    // -------------------------------------------------------
    // 🔄 ITERAR GESTIONES AÑO LABORAL
    // -------------------------------------------------------
    while (currentStartDate < parsedEndDate) {

      const currentEndDate = currentStartDate.plus({ years: 1 });
      const adjustedEndDate = currentEndDate > parsedEndDate ? parsedEndDate : currentEndDate;

      // 🟦 AQUÍ SE CORRIGE — ANTES SE USABA 0 FORZADO
      const deudaAnterior = deudaAcumulativa;

      // ---------------------------
      // Verificar contrato OTRO
      // ---------------------------
      const contractInPeriod = contracts.find(c => {
        if (c.contractType?.trim().toLowerCase() !== 'otro') return false;

        const cStart = DateTime.fromISO(c.startDate, { zone: 'utc' });
        const cEnd = DateTime.fromISO(c.endDate, { zone: 'utc' });

        return currentStartDate >= cStart && adjustedEndDate <= cEnd;
      });

      const isOtherContract = !!contractInPeriod;

      if (isOtherContract) {

        detalles.push({
          startDate: currentStartDate.toJSDate(),
          endDate: adjustedEndDate.toJSDate(),
          deuda: 0,
          diasDeVacacion: 0,
          diasDeVacacionRestantes: 0,
          deudaAcumulativaHastaEstaGestion: 0,
          deudaAcumulativaAnterior: 0,
          diasDisponibles: 0,
          contratoTipo: 'OTRO'
        });

      } else {
        // Normal
        const result = await this.calculateVacationDays(
          carnetIdentidad,
          currentStartDate.toJSDate(),
          adjustedEndDate.toJSDate()
        );

        // Aplicar deuda adicional
        deudaAcumulativa += result.deuda ?? 0;

        // Restar días disponibles si corresponde
        const resto = result.diasDeVacacionRestantes ?? 0;
        if (resto > 0) deudaAcumulativa = Math.max(0, deudaAcumulativa - resto);

        const diasDisponibles = Math.max(0, resto - deudaAnterior);

        detalles.push({
          startDate: currentStartDate.toJSDate(),
          endDate: adjustedEndDate.toJSDate(),
          deuda: result.deuda ?? 0,
          diasDeVacacion: result.diasDeVacacion ?? 0,
          diasDeVacacionRestantes: resto,
          deudaAcumulativaHastaEstaGestion: deudaAcumulativa,
          deudaAcumulativaAnterior: deudaAnterior,
          diasDisponibles,
          contratoTipo: 'NORMAL'
        });
      }

      currentStartDate = currentStartDate.plus({ years: 1 });
      isFirstGestion = false;
    }

    // -------------------------------------------------------
    // RESUMEN
    // -------------------------------------------------------
    const gestionesConDeuda = detalles.filter(d => d.deuda > 0).length;
    const gestionesSinDeuda = detalles.length - gestionesConDeuda;

    const resumenGeneral: ResumenGeneral = {
      deudaTotal: deudaAcumulativa,
      diasDisponiblesActuales: detalles.reduce((s, d) => s + (d.diasDisponibles || 0), 0),
      gestionesConDeuda,
      gestionesSinDeuda,
      promedioDeudaPorGestion: detalles.length > 0 ?
        detalles.reduce((s, d) => s + d.deuda, 0) / detalles.length : 0,
      primeraGestion: detalles[0]?.startDate || null,
      ultimaGestion: detalles[detalles.length - 1]?.endDate || null
    };

    return { deudaAcumulativa, detalles, resumenGeneral };
  }





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