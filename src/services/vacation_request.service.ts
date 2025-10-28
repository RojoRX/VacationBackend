import { Injectable, HttpException, HttpStatus, forwardRef, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { VacationRequest } from 'src/entities/vacation_request.entity';
import { UserService } from 'src/services/user.service';
import { NonHolidayService } from 'src/services/nonholiday.service';
import {
  calculateVacationDays,
  calculateReturnDate,
  ensureNoOverlappingVacations,
  countAuthorizedVacationDaysInRange,
  getAuthorizedVacationRequestsInRange,
} from 'src/utils/vacation-request-utils';
import { VacationRequestDTO } from 'src/dto/vacation-request.dto';
import { VacationService } from './vacation.service';
import { NotificationService } from './notification.service';
import { VacationDetail } from 'src/interfaces/vacation-detail';
import { User } from 'src/entities/user.entity';
import { CreatePastVacationDto } from 'src/dto/create-past-vacation.dto';
import { DateTime } from 'luxon';
import { RoleEnum } from 'src/enums/role.enum';


@Injectable()
export class VacationRequestService {
  constructor(
    @InjectRepository(VacationRequest)

    private readonly vacationRequestRepository: Repository<VacationRequest>,
    private readonly userService: UserService,
    private readonly nonHolidayService: NonHolidayService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(forwardRef(() => VacationService))
    private readonly vacationService: VacationService,
    private readonly notificationService: NotificationService,
  ) { }

  async createVacationRequest(
    ci: string,
    startDate: string,
    position: string,
    managementPeriod: { startPeriod: string; endPeriod: string },
  ): Promise<Omit<VacationRequest, 'user'> & { ci: string, totalWorkingDays: number }> {

    // Buscar el usuario por CI
    const user = await this.userService.findByCarnet(ci);
    if (!user) {
      throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
    }
    console.log('Usuario encontrado:', user.fullName, user.ci);

    // Verificar TODAS las solicitudes de vacaciones para el usuario
    const allVacationRequests = await this.vacationRequestRepository.find({
      where: {
        user: { id: user.id },
        deleted: false,
      },
      order: { requestDate: 'DESC' },
    });

    if (allVacationRequests.length > 0) {
      const hasPendingRequest = allVacationRequests.some(request => request.status === 'PENDING');
      if (hasPendingRequest) {
        throw new HttpException('No puedes crear una nueva solicitud. Hay una solicitud pendiente.', HttpStatus.BAD_REQUEST);
      }
      const lastVacationRequest = allVacationRequests[0];
      const isAuthorizedOrSuspended =
        (lastVacationRequest.status === 'AUTHORIZED' || lastVacationRequest.status === 'SUSPENDED') &&
        lastVacationRequest.approvedByHR &&
        lastVacationRequest.approvedBySupervisor;

      if (!isAuthorizedOrSuspended) {
        throw new HttpException(
          'No puedes crear una nueva solicitud. La última solicitud no está completamente autorizada, suspendida y aprobada.',
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Crear fechas de período de gestión
    const startPeriodDate = new Date(Date.UTC(
      parseInt(managementPeriod.startPeriod.substring(0, 4)),
      parseInt(managementPeriod.startPeriod.substring(5, 7)) - 1,
      parseInt(managementPeriod.startPeriod.substring(8, 10))
    ));
    const endPeriodDate = new Date(Date.UTC(
      parseInt(managementPeriod.endPeriod.substring(0, 4)),
      parseInt(managementPeriod.endPeriod.substring(5, 7)) - 1,
      parseInt(managementPeriod.endPeriod.substring(8, 10))
    ));
    const startPeriodIso = startPeriodDate.toISOString();
    const endPeriodIso = endPeriodDate.toISOString();

    // Obtener las gestiones acumuladas
    const accumulatedDebtResponse = await this.vacationService.calculateAccumulatedDebt(ci, endPeriodIso);

    // Validar que no existan gestiones anteriores con días disponibles
    this.validateVacationRequest(
      accumulatedDebtResponse.detalles,
      managementPeriod.startPeriod,
      managementPeriod.endPeriod
    );

    // Lógica para encontrar la gestión correspondiente
    const gestionCorrespondiente = accumulatedDebtResponse.detalles.find((gestion) => {
      return new Date(gestion.endDate).getTime() === endPeriodDate.getTime();
    });
    if (!gestionCorrespondiente) {
      throw new HttpException(
        `No se encontró una gestión válida para la fecha de fin del período de gestión (${endPeriodDate.toISOString()}).`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verificar si hay días disponibles
    if (gestionCorrespondiente.diasDisponibles <= 0) {
      throw new HttpException(
        `No puedes solicitar vacaciones. No tienes días disponibles en la gestión seleccionada.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // ---------------------------
    // Helper local: detectar día no laborable (fin de semana o feriado si el servicio lo soporta)
    // ---------------------------
    const isNonWorkingDate = async (date: Date): Promise<boolean> => {
      const dow = date.getUTCDay();
      // weekend
      if (dow === 0 || dow === 6) return true;

      // chequeo con nonHolidayService (si existe): intentamos métodos comunes
      const isoDate = date.toISOString().split('T')[0];
      try {
        if (this.nonHolidayService) {
          // método típico: isNonWorkingDay(dateString)
          if (typeof (this.nonHolidayService as any).isNonWorkingDay === 'function') {
            const r = (this.nonHolidayService as any).isNonWorkingDay(isoDate);
            return r instanceof Promise ? await r : r;
          }
          // otro método común: isHoliday(dateString) -> true si es feriado
          if (typeof (this.nonHolidayService as any).isHoliday === 'function') {
            const r = (this.nonHolidayService as any).isHoliday(isoDate);
            return r instanceof Promise ? await r : r;
          }
          // método inverso: isNonHoliday(dateString) -> true si NO es feriado
          if (typeof (this.nonHolidayService as any).isNonHoliday === 'function') {
            const r = (this.nonHolidayService as any).isNonHoliday(isoDate);
            const val = r instanceof Promise ? await r : r;
            return !val; // si isNonHoliday = false => es feriado => no laborable
          }
        }
      } catch (e) {
        // Si falla el servicio, ignoramos y usamos solo fin de semana
        console.warn('nonHolidayService check failed, fallback a solo weekend check', e);
      }

      return false; // por defecto es laborable (no feriado detectado)
    };

    // ---------------------------
    // Calcular endDate tomando en cuenta medios días (.5)
    // ---------------------------
    const startDateObj = new Date(startDate + "T00:00:00Z"); // forzar UTC
    const daysToTake = gestionCorrespondiente.diasDisponibles;
    const fullDays = Math.floor(daysToTake);
    const hasHalfDay = daysToTake % 1 !== 0;

    let workingDaysCount = 0;
    let currentDate = new Date(startDateObj);

    // Avanzar por los días completos (solo contar días hábiles)
    while (workingDaysCount < fullDays) {
      const dayOfWeek = currentDate.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // además, si tenemos nonHolidayService, podríamos comprobar feriados cuando contemos
        // (opcional) si date es feriado, no incrementar
        const isNonWorking = await isNonWorkingDate(currentDate);
        if (!isNonWorking) {
          workingDaysCount++;
        }
      }
      if (workingDaysCount < fullDays) {
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    }

    // currentDate ahora apunta al último día completo consumido (o al startDate si fullDays === 0 y ese día es laborable)
    // Si hay medio día, el medio día se toma en el SIGUIENTE día hábil:
    let endDateFinal = new Date(currentDate);
    if (hasHalfDay) {
      // avanzar al siguiente día hábil (saltando fin de semana y feriados)
      endDateFinal.setUTCDate(endDateFinal.getUTCDate() + 1);
      while (await isNonWorkingDate(endDateFinal)) {
        endDateFinal.setUTCDate(endDateFinal.getUTCDate() + 1);
      }
      console.log('⚠️ Incluyendo medio día en la fecha final (half day):', endDateFinal.toISOString().split('T')[0]);
    } else {
      // Si no hay medio día, endDateFinal ya es currentDate
      // Aseguramos que si currentDate cae en fin de semana/feriado (raro), lo movemos al próximo laborable
      while (await isNonWorkingDate(endDateFinal)) {
        endDateFinal.setUTCDate(endDateFinal.getUTCDate() + 1);
      }
    }

    const endDateCalculated = endDateFinal.toISOString().split('T')[0];
    console.log('Fecha de fin calculada (endDateCalculated):', endDateCalculated);

    // Verificar si las fechas se solapan (usamos startDate y el endDate calculado)
    await ensureNoOverlappingVacations(this.vacationRequestRepository, user.id, startDate, endDateCalculated);

    // Los días solicitados ahora son los días disponibles (decimales permitidos)
    const daysRequested = daysToTake;
    console.log('Días solicitados (daysRequested):', daysRequested);

    // Preparar fechas ISO
    const startDateForISO = new Date(startDate + "T00:00:00Z").toISOString();
    const endDateISO = new Date(endDateCalculated + "T23:59:59Z").toISOString();
    console.log('startDateISO:', startDateForISO);
    console.log('endDateISO:', endDateISO);

    // Calcular fecha de reincorporación:
    // - Si hubo medio día: el retorno es el MISMO día (la persona se reincorpora ese mismo día),
    // - Si no hubo medio día: usar la lógica existente para obtener el siguiente día hábil de reincorporación.
    let returnDateISO: string;
    if (hasHalfDay) {
      // Reincorpora ese mismo día (puedes ajustar a hora específica si manejas horarios)
      returnDateISO = new Date(endDateCalculated + "T00:00:00Z").toISOString();
    } else {
      returnDateISO = new Date(
        await calculateReturnDate(endDateISO, daysRequested, this.nonHolidayService)
      ).toISOString();
    }
    console.log('Fecha de reincorporación (returnDateISO):', returnDateISO);

    // Crear y guardar la solicitud
    const vacationRequest = this.vacationRequestRepository.create({
      user,
      position,
      requestDate: new Date().toISOString(),
      startDate: startDateForISO,
      endDate: endDateISO,
      totalDays: daysRequested,
      status: 'PENDING',
      returnDate: returnDateISO,
      managementPeriodStart: startPeriodDate.toISOString(),
      managementPeriodEnd: endPeriodDate.toISOString(),
    });
    console.log('Objeto vacationRequest creado:', vacationRequest);

    const savedRequest = await this.vacationRequestRepository.save(vacationRequest);
    console.log('Solicitud guardada:', savedRequest);

    // Notificar
    await this.notificationService.notifyRelevantSupervisorsAndAdmins(
      `El usuario ${user.fullName} ha creado una nueva solicitud de vacaciones del ${startDate} al ${endDateCalculated} (${daysRequested} días).`,
      user.id,
      'VACATION',
      savedRequest.id
    );

    // Retornar sin datos sensibles
    const { user: _user, ...requestWithoutSensitiveData } = savedRequest;

    return { ...requestWithoutSensitiveData, ci: user.ci, totalWorkingDays: daysRequested };
  }

  async updateVacationRequest(
    requestId: number,
    updateData: {
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Omit<VacationRequest, 'user'> & { ci: string; totalWorkingDays: number }> {

    // Buscar la solicitud existente
    const existingRequest = await this.vacationRequestRepository.findOne({
      where: { id: requestId, deleted: false },
      relations: ['user']
    });

    if (!existingRequest) {
      throw new HttpException('Solicitud de vacaciones no encontrada', HttpStatus.NOT_FOUND);
    }

    const user = existingRequest.user;
    console.log('Editando solicitud para usuario:', user.fullName, user.ci);

    // Usar las fechas nuevas o las existentes
    const newStartDate = updateData.startDate || existingRequest.startDate.split('T')[0];
    const newEndDate = updateData.endDate || existingRequest.endDate.split('T')[0];

    // Validar que al menos una fecha fue proporcionada para edición
    if (!updateData.startDate && !updateData.endDate) {
      throw new HttpException('Debe proporcionar al menos una fecha para editar (startDate o endDate)', HttpStatus.BAD_REQUEST);
    }

    // Obtener las gestiones acumuladas usando la fecha de fin del período de gestión existente
    const accumulatedDebtResponse = await this.vacationService.calculateAccumulatedDebt(
      user.ci,
      existingRequest.managementPeriodEnd
    );

    // Encontrar la gestión correspondiente
    const endPeriodDate = new Date(existingRequest.managementPeriodEnd);
    const gestionCorrespondiente = accumulatedDebtResponse.detalles.find((gestion) => {
      return new Date(gestion.endDate).getTime() === endPeriodDate.getTime();
    });

    if (!gestionCorrespondiente) {
      throw new HttpException(
        `No se encontró una gestión válida para la fecha de fin del período de gestión.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    // Calcular días totales permitidos para la edición
    const originalTotalDays = Math.round(existingRequest.totalDays * 100) / 100;
    let maxAllowedDays: number;

    const diasDisponibles = Math.round(gestionCorrespondiente.diasDisponibles * 100) / 100;

    if (diasDisponibles > 0) {
      // Si hay días disponibles, podemos usar los días originales + días disponibles
      maxAllowedDays = originalTotalDays + diasDisponibles;
      console.log(`Días disponibles encontrados: ${diasDisponibles}. Máximo permitido: ${maxAllowedDays}`);
    } else {
      // Si no hay días disponibles, solo podemos usar los días originales
      maxAllowedDays = originalTotalDays;
      console.log(`Sin días disponibles. Máximo permitido: ${maxAllowedDays}`);
    }

    // ---------------------------
    // Helper local: detectar día no laborable (mismo que en create)
    // ---------------------------
    const isNonWorkingDate = async (date: Date): Promise<boolean> => {
      const dow = date.getUTCDay();
      if (dow === 0 || dow === 6) return true;

      const isoDate = date.toISOString().split('T')[0];
      try {
        if (this.nonHolidayService) {
          if (typeof (this.nonHolidayService as any).isNonWorkingDay === 'function') {
            const r = (this.nonHolidayService as any).isNonWorkingDay(isoDate);
            return r instanceof Promise ? await r : r;
          }
          if (typeof (this.nonHolidayService as any).isHoliday === 'function') {
            const r = (this.nonHolidayService as any).isHoliday(isoDate);
            return r instanceof Promise ? await r : r;
          }
          if (typeof (this.nonHolidayService as any).isNonHoliday === 'function') {
            const r = (this.nonHolidayService as any).isNonHoliday(isoDate);
            const val = r instanceof Promise ? await r : r;
            return !val;
          }
        }
      } catch (e) {
        console.warn('nonHolidayService check failed, fallback a solo weekend check', e);
      }
      return false;
    };

    // ---------------------------
    // Calcular días solicitados basado en las nuevas fechas
    // ---------------------------
    const startDateObj = new Date(newStartDate + "T00:00:00Z");
    const endDateObj = new Date(newEndDate + "T00:00:00Z");

    // Validar que la fecha de inicio no sea posterior a la fecha de fin
    if (startDateObj > endDateObj) {
      throw new HttpException('La fecha de inicio no puede ser posterior a la fecha de fin', HttpStatus.BAD_REQUEST);
    }

    // Calcular días laborables entre las fechas
    let workingDaysCount = 0;
    let currentDate = new Date(startDateObj);
    const finalEndDate = new Date(endDateObj);

    while (currentDate <= finalEndDate) {
      const isNonWorking = await isNonWorkingDate(currentDate);
      if (!isNonWorking) {
        workingDaysCount++;
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Verificar si hay medio día en los días disponibles o en los días originales
    const hasHalfDayInAvailable = gestionCorrespondiente.diasDisponibles % 1 !== 0;
    const hasHalfDayInOriginal = originalTotalDays % 1 !== 0;
    const calculatedDays = workingDaysCount;

    // Aplicar lógica de medio día si corresponde
    let actualDaysRequested = calculatedDays;
    if (hasHalfDayInAvailable || hasHalfDayInOriginal) {
      // Si hay medio día en cualquiera de los dos, tratamos como medio día
      actualDaysRequested = calculatedDays - 0.5;
      console.log('⚠️ Aplicando lógica de medio día. Días calculados:', actualDaysRequested);
    }

    // Validar que no exceda el máximo permitido
    if (actualDaysRequested > maxAllowedDays) {
      throw new HttpException(
        `Los días solicitados (${actualDaysRequested}) exceden el máximo permitido (${maxAllowedDays})`,
        HttpStatus.BAD_REQUEST
      );
    }

    console.log('Días calculados para la edición:', actualDaysRequested);

    // Verificar solapamiento con otras solicitudes (excluyendo la actual)
    await ensureNoOverlappingVacations(
      this.vacationRequestRepository,
      user.id,
      newStartDate,
      newEndDate,
      existingRequest.id   // 👈 excluimos la misma solicitud
    );


    // Calcular fecha de reincorporación
    let returnDateISO: string;
    if (hasHalfDayInAvailable || hasHalfDayInOriginal) {
      // Si hay medio día, la reincorporación es el mismo día de la fecha fin
      returnDateISO = new Date(newEndDate + "T00:00:00Z").toISOString();
      console.log('Reincorporación el mismo día (medio día)');
    } else {
      // Lógica normal de reincorporación (usando el mismo helper que en create)
      returnDateISO = new Date(
        await calculateReturnDate(
          new Date(newEndDate + "T23:59:59Z").toISOString(),
          actualDaysRequested,
          this.nonHolidayService
        )
      ).toISOString();
    }

    // Actualizar la solicitud
    existingRequest.startDate = new Date(newStartDate + "T00:00:00Z").toISOString();
    existingRequest.endDate = new Date(newEndDate + "T23:59:59Z").toISOString();
    existingRequest.totalDays = actualDaysRequested;
    existingRequest.returnDate = returnDateISO;

    const updatedRequest = await this.vacationRequestRepository.save(existingRequest);
    console.log('Solicitud actualizada:', updatedRequest);


    // Retornar sin datos sensibles
    const { user: _user, ...requestWithoutSensitiveData } = updatedRequest;
    return { ...requestWithoutSensitiveData, ci: user.ci, totalWorkingDays: actualDaysRequested };
  }

  // Método auxiliar para validar gestiones anteriores con días disponibles
  private validateVacationRequest(
    detalles: VacationDetail[],
    startPeriod: string,
    endPeriod: string
  ): void {
    const requestedStartDate = new Date(startPeriod);

    const hayGestionesAnterioresConDiasDisponibles = detalles.some((gestion) => {
      const gestionStartDate = new Date(gestion.startDate);
      return gestionStartDate < requestedStartDate && gestion.diasDisponibles > 0;
    });

    if (hayGestionesAnterioresConDiasDisponibles) {
      throw new BadRequestException(
        'No se puede crear la solicitud de vacaciones: existen gestiones anteriores con días disponibles.'
      );
    }

  }

  // Método para obtener todas las solicitudes de vacaciones de un usuario
  async getUserVacationRequests(userId: number): Promise<(Omit<VacationRequest, 'user'> & { ci: string })[]> {
    const requests = await this.vacationRequestRepository.find({
      where: {
        user: { id: userId },
        deleted: false, // 👈 Evitar solicitudes eliminadas lógicamente
      },
      relations: ['user'],
    });

    return requests.map((request) => {
      const { user, ...requestWithoutSensitiveData } = request;
      return { ...requestWithoutSensitiveData, ci: user.ci };
    });
  }

  // Método para obtener todas las solicitudes de vacaciones
  async getAllVacationRequests(): Promise<(Omit<VacationRequest, 'user'> & { ci: string, username: string, fullname: string, department?: string, academicUnit?: string })[]> {
    const requests = await this.vacationRequestRepository.find({
      where: { deleted: false }, // 👈 Excluir solicitudes eliminadas
      relations: ['user', 'user.department', 'user.academicUnit'],
    });

    return requests.map((request, index) => {
      const { user, ...requestWithoutSensitiveData } = request;

      const ci = user?.ci ?? 'N/A';
      const username = user?.username ?? 'N/A';
      const fullname = user?.fullName ?? 'N/A';
      const department = user?.department?.name ?? null;
      const academicUnit = user?.academicUnit?.name ?? null;


      return {
        ...requestWithoutSensitiveData,
        ci,
        username,
        fullname,
        department,
        academicUnit,
      };
    });
  }

  async countAuthorizedVacationDaysInRange(
    ci: string,
    startDate: string,
    endDate: string
  ): Promise<{ requests: VacationRequest[]; totalAuthorizedVacationDays: number }> {
    if (new Date(startDate) > new Date(endDate)) {
      throw new HttpException('Invalid date range', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userService.findByCarnet(ci);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const startDateWithoutTime = new Date(startDate).toISOString().split('T')[0];
    const endDateWithoutTime = new Date(endDate).toISOString().split('T')[0];

    const authorizedVacationDays = await this.vacationRequestRepository.find({
      where: {
        user: { id: user.id },
        status: In(['AUTHORIZED', 'SUSPENDED']),
        approvedByHR: true,
        managementPeriodStart: startDateWithoutTime,
        managementPeriodEnd: endDateWithoutTime,
        deleted: false, // 👈 Añadido para excluir eliminados lógicamente
      },
    });

    if (!authorizedVacationDays || !Array.isArray(authorizedVacationDays)) {
      throw new HttpException('Failed to fetch authorized vacation days', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const totalAuthorizedDays = authorizedVacationDays.reduce(
      (total, request) => total + (Number(request.totalDays) || 0),
      0
    );


    return {
      requests: authorizedVacationDays,
      totalAuthorizedVacationDays: totalAuthorizedDays,
    };
  }

  // Método para actualizar el estado de la solicitud de vacaciones METODO USADO Supervisores
  async updateVacationRequestStatus(
    id: number,
    status: string,
    supervisorId: number,
  ): Promise<VacationRequestDTO> {
    console.log('Usando este metodo');
    console.log('updateVacationRequestStatus - Received supervisorId:', supervisorId);

    const request = await this.vacationRequestRepository.findOne({
      where: { id },
      relations: ['user', 'approvedBy', 'user.department', 'user.academicUnit'],
    });

    if (!request) {
      throw new HttpException('Vacation request not found', HttpStatus.NOT_FOUND);
    }

    // Validar si ya fue revisada
    if (request.status !== 'PENDING') {
      throw new HttpException('No se puede modificar una solicitud que ya ha sido revisada.', HttpStatus.BAD_REQUEST);
    }

    // Después:
    const supervisor = await this.userService.findById(supervisorId, {
      relations: ['department', 'academicUnit'],
    });

    if (!supervisor) {
      throw new HttpException('Supervisor not found', HttpStatus.NOT_FOUND);
    }

    const tipoSupervisor = supervisor.tipoEmpleado;

    console.log('Supervisor tipoEmpleado:', tipoSupervisor);
    console.log('Supervisor departamento:', supervisor.department);
    console.log('Supervisor unidad académica:', supervisor.academicUnit);
    console.log('Usuario departamento:', request.user.department);
    console.log('Usuario unidad académica:', request.user.academicUnit);

    if (tipoSupervisor === 'ADMINISTRATIVO') {
      console.log('Validando por DEPARTAMENTO');
      if (!supervisor.department || !request.user.department) {
        console.log('Fallo: uno de los departamentos es null');
        throw new HttpException(
          'No autorizado para aprobar solicitudes fuera de su departamento',
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (supervisor.department.id !== request.user.department.id) {
        console.log(
          `Fallo: ID del departamento del supervisor (${supervisor.department.id}) no coincide con el del usuario (${request.user.department.id})`
        );
        throw new HttpException(
          'No autorizado para aprobar solicitudes fuera de su departamento',
          HttpStatus.UNAUTHORIZED,
        );
      }
    } else if (tipoSupervisor === 'DOCENTE') {
      console.log('Validando por UNIDAD ACADÉMICA');
      if (!supervisor.academicUnit || !request.user.academicUnit) {
        console.log('Fallo: una de las unidades académicas es null');
        throw new HttpException(
          'No autorizado para aprobar solicitudes fuera de su unidad académica',
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (supervisor.academicUnit.id !== request.user.academicUnit.id) {
        console.log(
          `Fallo: ID de la unidad académica del supervisor (${supervisor.academicUnit.id}) no coincide con la del usuario (${request.user.academicUnit.id})`
        );
        throw new HttpException(
          'No autorizado para aprobar solicitudes fuera de su unidad académica',
          HttpStatus.UNAUTHORIZED,
        );
      }
    } else {
      console.log('Tipo de supervisor no reconocido:', tipoSupervisor);
      throw new HttpException('Tipo de supervisor no reconocido', HttpStatus.BAD_REQUEST);
    }


    const validStatuses = ['PENDING', 'AUTHORIZED', 'DENIED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      throw new HttpException('Estado inválido proporcionado', HttpStatus.BAD_REQUEST);
    }

    request.status = status;
    request.approvedBySupervisor = true;
    request.reviewDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    await this.vacationRequestRepository.save(request);

    // Notificación
    try {
      const statusLabels: Record<string, string> = {
        PENDING: 'Pendiente',
        AUTHORIZED: 'Autorizada',
        DENIED: 'Rechazada',
        SUSPENDED: 'Suspendida',
      };

      const statusLabel = statusLabels[status] || status;

      await this.notificationService.notifyUser({
        recipientId: request.user.id,
        message: `Tu solicitud de vacaciones fue revisada por el supervisor y se encuentra como "${statusLabel}".`,
        resourceType: 'VACATION',
        resourceId: request.id,
      });


    } catch (error) {
      console.error('Error al crear la notificación:', error);
    }

    return {
      id: request.id,
      position: request.position,
      requestDate: request.requestDate,
      startDate: request.startDate,
      endDate: request.endDate,
      totalDays: request.totalDays,
      status: request.status,
      returnDate: request.returnDate,
      reviewDate: request.reviewDate,
      postponedDate: request.postponedDate,
      postponedReason: request.postponedReason,
      approvedByHR: request.approvedByHR,
      approvedBySupervisor: request.approvedBySupervisor,
      user: {
        id: request.user.id,
        ci: request.user.ci,
        fecha_ingreso: request.user.fecha_ingreso,
        username: request.user.username,
      },
      managementPeriodStart: request.managementPeriodStart,
      managementPeriodEnd: request.managementPeriodEnd,
      approvedBy: request.approvedBy ?? undefined,
    };
  }

  // Método para obtener todas las solicitudes de vacaciones de un departamento según el supervisor
  async getVacationRequestsBySupervisor(supervisorId: number): Promise<VacationRequestDTO[]> {
    // Buscar al supervisor
    const supervisor = await this.userService.findById(supervisorId, {
      relations: ['department', 'academicUnit'],
    });

    if (!supervisor) {
      throw new HttpException('Supervisor not found', HttpStatus.NOT_FOUND);
    }

    const { tipoEmpleado, department, academicUnit } = supervisor;

    let requests;

    if (tipoEmpleado === 'ADMINISTRATIVO' && department?.id) {
      requests = await this.vacationRequestRepository.find({
        where: {
          user: { department: { id: department.id } },
          deleted: false, // 👈 Excluir eliminadas
        },
        relations: ['user'],
      });
    } else if (tipoEmpleado === 'DOCENTE' && academicUnit?.id) {
      requests = await this.vacationRequestRepository.find({
        where: {
          user: { academicUnit: { id: academicUnit.id } },
          deleted: false, // 👈 Excluir eliminadas
        },
        relations: ['user'],
      });
    } else {
      throw new HttpException(
        'Supervisor must belong to a department or academic unit',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!requests || requests.length === 0) {
      throw new HttpException('No vacation requests found for this area', HttpStatus.NOT_FOUND);
    }

    return requests.map(request => {
      const { user, ...rest } = request;
      return {
        ...rest,
        user: {
          id: user.id,
          ci: user.ci,
          fecha_ingreso: user.fecha_ingreso,
          username: user.username,
          fullname: user.fullName
        },
      } as VacationRequestDTO;
    });
  }

  // Método para obtener una solicitud de vacaciones por su ID
  async getVacationRequestById(id: number): Promise<VacationRequestDTO> {
    // Buscar la solicitud con las relaciones necesarias
    const request = await this.vacationRequestRepository.findOne({
      where: { id },
      relations: [
        'user',
        'user.academicUnit',
        'user.department',
        'approvedBy',
      ],
    });

    if (!request) {
      throw new HttpException('Vacation request not found', HttpStatus.NOT_FOUND);
    }

    const vacationRequestDTO: VacationRequestDTO = {
      id: request.id,
      position: request.position,
      requestDate: request.requestDate,
      startDate: request.startDate,
      endDate: request.endDate,
      totalDays: request.totalDays,
      status: request.status,
      returnDate: request.returnDate,
      postponedDate: request.postponedDate,
      reviewDate: request.reviewDate,
      postponedReason: request.postponedReason,
      approvedByHR: request.approvedByHR,
      approvedBySupervisor: request.approvedBySupervisor,
      user: {
        id: request.user.id,
        ci: request.user.ci,
        fecha_ingreso: request.user.fecha_ingreso,
        username: request.user.username,
        academicUnitName: request.user.academicUnit?.name || null,
        departmentName: request.user.department?.name || null,
      },
      managementPeriodStart: request.managementPeriodStart,
      managementPeriodEnd: request.managementPeriodEnd,
      approvedBy: request.approvedBy
        ? {
          id: request.approvedBy.id,
          ci: request.approvedBy.ci,
          fecha_ingreso: request.approvedBy.fecha_ingreso,
          username: request.approvedBy.username,
        }
        : undefined,
    };

    return vacationRequestDTO;
  }




  async getVacationRequestDetails(id: number): Promise<any> {
    const request = await this.vacationRequestRepository.findOne({
      where: { id },
      relations: ['user', 'user.department', 'user.academicUnit'], // Añadido academicUnit
    });

    if (!request) {
      throw new HttpException('Vacation request not found', HttpStatus.NOT_FOUND);
    }

    if (!request.user) {
      throw new HttpException('User not found for this vacation request', HttpStatus.NOT_FOUND);
    }

    const ci = request.user.ci;
    const managementPeriodStart = request.managementPeriodStart;
    const managementPeriodEnd = request.managementPeriodEnd;

    if (!managementPeriodStart || !managementPeriodEnd) {
      throw new HttpException('Management period not found for this request', HttpStatus.NOT_FOUND);
    }

    let vacationResponse;
    try {
      vacationResponse = await this.vacationService.calculateVacationDays(
        ci,
        new Date(managementPeriodStart),
        new Date(managementPeriodEnd)
      );
    } catch (error) {
      console.error('Error al calcular los días de vacaciones:', error);
      throw new HttpException('Error al calcular los días de vacaciones', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return {
      requestId: request.id,
      userName: request.user.fullName,
      ci: request.user.ci,
      position: request.user.position,
      requestDate: request.requestDate,
      // Mostrar uno u otro nombre según corresponda
      department: request.user.department?.name || null,
      academicUnit: request.user.academicUnit?.name || null,
      startDate: request.startDate,
      endDate: request.endDate,
      reviewDate: request.reviewDate,
      totalDays: request.totalDays,
      status: request.status,
      returnDate: request.returnDate,
      postponedDate: request.postponedDate,
      postponedReason: request.postponedReason,
      approvedByHR: request.approvedByHR,
      approvedBySupervisor: request.approvedBySupervisor,
      managementPeriodStart,
      managementPeriodEnd,
      fechaIngreso: vacationResponse.fechaIngreso,
      antiguedadEnAnios: vacationResponse.antiguedadEnAnios,
      diasDeVacacion: vacationResponse.diasDeVacacion,
      diasDeVacacionRestantes: vacationResponse.diasDeVacacionRestantes,
      recesos: vacationResponse.recesos,
      licenciasAutorizadas: vacationResponse.licenciasAutorizadas,
      solicitudesDeVacacionAutorizadas: vacationResponse.solicitudesDeVacacionAutorizadas,
      deleted: request.deleted
    };
  }

  // Actualizar el estado de una solicitud por el supervisor
  async updateStatus(id: number, newStatus: string): Promise<VacationRequest> {
    const validStatuses = ['PENDING', 'AUTHORIZED', 'POSTPONED', 'DENIED', 'SUSPENDED'];
    if (!validStatuses.includes(newStatus)) {
      throw new BadRequestException('Invalid status');
    }

    // Carga también el usuario relacionado
    const entity = await this.vacationRequestRepository.findOne({
      where: { id },
      relations: ['user'], // 👈 necesario para acceder a user.id
    });

    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    console.log('Usuario relacionado con la solicitud:', entity.user);

    entity.status = newStatus;
    if (!entity.approvedBySupervisor) {
      entity.approvedBySupervisor = true;
    }

    const today = new Date();
    entity.reviewDate = today.toISOString().split('T')[0];

    // Guarda primero
    const updatedRequest = await this.vacationRequestRepository.save(entity);
    console.log('Solicitud actualizada:', updatedRequest);

    // Luego notifica
    const statusLabels: Record<string, string> = {
      PENDING: 'Pendiente',
      AUTHORIZED: 'Autorizada',
      POSTPONED: 'Postergada',
      DENIED: 'Rechazada',
      SUSPENDED: 'Suspendida',
    };

    const statusLabel = statusLabels[newStatus] || newStatus;

    console.log('Intentando notificar al usuario con ID:', updatedRequest.user.id);

    try {
      const notification = await this.notificationService.notifyUser({
        recipientId: updatedRequest.user.id,
        message: `Tu solicitud de vacaciones fue revisada por el supervisor y se encuentra como "${statusLabel}".`,
      });

      console.log('Notificación guardada correctamente:', notification);
    } catch (error) {
      console.error('Error al guardar la notificación:', error);
    }

    return updatedRequest;
  }
  async toggleApprovedByHR(
    vacationRequestId: number,
    hrUserId: number
  ): Promise<VacationRequest> {
    const vacationRequest = await this.vacationRequestRepository.findOne({
      where: { id: vacationRequestId },
      relations: ['user'],
    });

    if (!vacationRequest) {
      throw new Error('Solicitud de vacaciones no encontrada');
    }

    // Si ya fue aprobada por RRHH, no se puede volver a aprobar
    if (vacationRequest.approvedByHR === true) {
      throw new Error('La solicitud de vacaciones ya fue departamento de Personal.');
    }

    // Aprobar por primera vez
    vacationRequest.approvedByHR = true;

    await this.vacationRequestRepository.save(vacationRequest);

    await this.notificationService.notifyUser({
      recipientId: vacationRequest.user.id,
      message: `Tu solicitud de vacaciones fue aprobada por el departamento de Personal.`,
    });


    return vacationRequest;
  }
  // Método para posponer una solicitud de vacaciones
  async postponeVacationRequest(
    id: number,
    postponedDate: string,
    postponedReason: string,
    supervisorId: number,
  ): Promise<VacationRequestDTO> {
    // Buscar la solicitud de vacaciones por ID, incluyendo la relación con el usuario
    const request = await this.vacationRequestRepository.findOne({
      where: { id },
      relations: ['user', 'approvedBy', 'user.department'], // Incluir la relación con el aprobador y el departamento
    });

    if (!request) {
      throw new HttpException('Vacation request not found', HttpStatus.NOT_FOUND);
    }

    // Verificar que el supervisor tenga permiso para posponer solicitudes de su departamento
    const supervisor = await this.userService.findById(supervisorId);
    if (!supervisor || supervisor.department.id !== request.user.department.id) {
      throw new HttpException('Unauthorized to postpone requests outside your department', HttpStatus.UNAUTHORIZED);
    }

    // Validar que la fecha de posposición no sea anterior a la fecha actual
    const currentDate = new Date().toISOString().split('T')[0];
    if (postponedDate < currentDate) {
      throw new HttpException('Postponed date cannot be in the past', HttpStatus.BAD_REQUEST);
    }

    // Actualizar los campos de posposición y el estado de la solicitud
    request.status = 'POSTPONED';
    request.postponedDate = postponedDate;
    request.postponedReason = postponedReason;
    request.approvedBySupervisor = true; // Indica que fue aprobado por el supervisor

    // Guardar los cambios en la base de datos
    await this.vacationRequestRepository.save(request);

    // Mapear a DTO
    const vacationRequestDTO: VacationRequestDTO = {
      id: request.id,
      position: request.position,
      requestDate: request.requestDate,
      startDate: request.startDate,
      endDate: request.endDate,
      totalDays: request.totalDays,
      status: request.status,
      returnDate: request.returnDate,
      reviewDate: request.reviewDate,
      postponedDate: request.postponedDate,
      postponedReason: request.postponedReason,
      approvedByHR: request.approvedByHR,
      approvedBySupervisor: request.approvedBySupervisor,
      user: {
        id: request.user.id,
        ci: request.user.ci,
        fecha_ingreso: request.user.fecha_ingreso,
        username: request.user.username,
      },
      managementPeriodStart: request.managementPeriodStart,
      managementPeriodEnd: request.managementPeriodEnd,
      approvedBy: request.approvedBy ? {
        id: request.approvedBy.id,
        ci: request.approvedBy.ci,
        fecha_ingreso: request.approvedBy.fecha_ingreso,
        username: request.approvedBy.username,
      } : undefined,
    };

    return vacationRequestDTO;
  }

  async suspendVacationRequest(
    requestId: number,
    updateData: {
      startDate: string;
      endDate: string;
    }
  ): Promise<VacationRequest> {
    const request = await this.vacationRequestRepository.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!request) {
      throw new NotFoundException(`Solicitud con ID ${requestId} no encontrada.`);
    }

    // Solo se puede suspender una solicitud autorizada y completamente aprobada
    if (
      request.status !== 'AUTHORIZED' ||
      !request.approvedByHR ||
      !request.approvedBySupervisor
    ) {
      throw new HttpException(
        'Solo se pueden suspender solicitudes que estén autorizadas y completamente aprobadas.',
        HttpStatus.BAD_REQUEST
      );
    }

    const userId = request.user.id;
    const startDateObj = new Date(updateData.startDate + 'T00:00:00Z');
    const endDateObj = new Date(updateData.endDate + 'T23:59:59Z');

    if (endDateObj <= startDateObj) {
      throw new HttpException('La fecha de fin debe ser posterior a la fecha de inicio.', HttpStatus.BAD_REQUEST);
    }

    // Validar solapamiento con otras solicitudes (excluyendo esta)
    try {
      // Validar solapamiento con otras solicitudes (excluyendo esta)
      await ensureNoOverlappingVacations(
        this.vacationRequestRepository,
        userId,
        updateData.startDate,
        updateData.endDate,
        requestId
      );
    } catch (error) {
      // Aquí capturamos el error lanzado desde ensureNoOverlappingVacations
      console.error('Error de solapamiento:', error.message);
      throw new BadRequestException(error.message);
    }


    // Calcular días hábiles entre startDate y endDate
    let currentDate = new Date(startDateObj);
    let workingDaysCount = 0;

    while (currentDate <= endDateObj) {
      const dayOfWeek = currentDate.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDaysCount++;
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    // 🚫 Validar que no se exceda el total autorizado
    if (workingDaysCount > request.totalDays) {
      throw new HttpException(
        `La suspensión no puede durar más días (${workingDaysCount}) que la solicitud original (${request.totalDays}).`,
        HttpStatus.BAD_REQUEST
      );
    }
    // Recalcular fecha de reincorporación
    const returnDateISO = new Date(
      await calculateReturnDate(endDateObj.toISOString(), workingDaysCount, this.nonHolidayService)
    ).toISOString();

    // Actualizar campos
    request.startDate = startDateObj.toISOString();
    request.endDate = endDateObj.toISOString();
    request.totalDays = workingDaysCount;
    request.returnDate = returnDateISO;
    request.status = 'SUSPENDED';
    request.reviewDate = new Date().toISOString();

    return this.vacationRequestRepository.save(request);
  }
  async checkLastRequestStatus(ci: string): Promise<{
    canRequest: boolean;
    reason?: string;
  }> {
    try {
      // 1. Validar usuario
      const user = await this.userService.findByCarnet(ci);
      if (!user) {
        return { canRequest: false, reason: 'Usuario no encontrado' };
      }

      // 2. Obtener la última solicitud que no esté eliminada
      const lastRequest = await this.vacationRequestRepository.findOne({
        where: {
          user: { id: user.id },
          deleted: false,
        },
        order: { requestDate: 'DESC' },
      });

      // Si no hay solicitudes previas, puede crear una nueva
      if (!lastRequest) {
        return { canRequest: true };
      }

      // 3. Validar estado de la última solicitud
      if (lastRequest.status === 'PENDING') {
        return {
          canRequest: false,
          reason: 'La última solicitud aún no ha sido revisada',
        };
      }

      if (
        lastRequest.status !== 'AUTHORIZED' &&
        lastRequest.status !== 'SUSPENDED'
      ) {
        return {
          canRequest: false,
          reason: 'La última solicitud no fue autorizada',
        };
      }

      if (!lastRequest.approvedByHR) {
        return {
          canRequest: false,
          reason: 'La última solicitud no fue aprobada por el departamento de personal',
        };
      }

      // Todas las validaciones pasaron
      return { canRequest: true };
    } catch (error) {
      console.error('Error al verificar estado de solicitud:', error);
      return {
        canRequest: false,
        reason: 'Error al verificar el estado de las solicitudes',
      };
    }
  }

  // Nuevo método para obtener el conteo de solicitudes PENDIENTES para un supervisor
  async getPendingVacationRequestsCountForSupervisor(supervisorId: number): Promise<number> {
    const supervisor = await this.userService.findById(supervisorId, {
      relations: ['department', 'academicUnit'],
    });

    if (!supervisor) {
      throw new HttpException('Supervisor no encontrado.', HttpStatus.NOT_FOUND);
    }

    const { tipoEmpleado, department, academicUnit } = supervisor;

    const queryBuilder = this.vacationRequestRepository.createQueryBuilder('vr');
    queryBuilder
      .leftJoin('vr.user', 'user')
      .where('vr.status = :status', { status: 'PENDING' })
      .andWhere('vr.deleted = false'); // <--- se excluyen eliminadas

    if (tipoEmpleado === 'ADMINISTRATIVO' && department?.id) {
      queryBuilder.andWhere('user.departmentId = :departmentId', { departmentId: department.id });
    } else if (tipoEmpleado === 'DOCENTE' && academicUnit?.id) {
      queryBuilder.andWhere('user.academicUnitId = :academicUnitId', { academicUnitId: academicUnit.id });
    } else {
      throw new HttpException(
        'El supervisor debe pertenecer a un departamento o unidad académica para revisar solicitudes.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const pendingCount = await queryBuilder.getCount();
    return pendingCount;
  }

async softDeleteVacationRequest(
  id: number,
  user: { id: number; role?: string },
): Promise<{ message: string }> {
  console.log('[softDeleteVacationRequest] Usuario que solicita la eliminación:', user);

  // 🔹 Buscar la solicitud de vacaciones
  const request = await this.vacationRequestRepository.findOne({
    where: { id },
    relations: ['user'],
  });

  if (!request) {
    console.log('[softDeleteVacationRequest] Solicitud no encontrada:', id);
    throw new HttpException('Solicitud de vacaciones no encontrada', HttpStatus.NOT_FOUND);
  }

  console.log('[softDeleteVacationRequest] Solicitud encontrada:', {
    id: request.id,
    userId: request.user.id,
    status: request.status,
    deleted: request.deleted,
    approvedByHR: request.approvedByHR,
    approvedBySupervisor: request.approvedBySupervisor,
  });

  if (request.deleted) {
    console.log('[softDeleteVacationRequest] La solicitud ya estaba eliminada:', request.id);
    throw new HttpException('La solicitud ya fue eliminada previamente', HttpStatus.BAD_REQUEST);
  }

  if (request.approvedByHR && request.approvedBySupervisor) {
    console.log('[softDeleteVacationRequest] La solicitud ya fue aprobada por HR y supervisor:', request.id);
    throw new HttpException(
      'No se puede eliminar una solicitud que ya fue aprobada por Recursos Humanos y el supervisor',
      HttpStatus.BAD_REQUEST,
    );
  }

  if (['AUTHORIZED', 'SUSPENDED'].includes(request.status)) {
    console.log('[softDeleteVacationRequest] Solicitud con estado no eliminable:', request.status);
    throw new HttpException(
      `No se puede eliminar una solicitud con estado '${request.status}'`,
      HttpStatus.BAD_REQUEST,
    );
  }

  // 🔹 Verificar si el rol viene en el token; si no, cargar desde BD
  const dbUser = user.role ? user : await this.userRepository.findOne({ where: { id: user.id } });
  console.log('[softDeleteVacationRequest] Usuario verificado en DB o token:', dbUser);

  const isAdmin = dbUser?.role?.toUpperCase() === 'ADMIN';
  const isOwner = request.user.id === dbUser.id;

  console.log('[softDeleteVacationRequest] isOwner:', isOwner, 'isAdmin:', isAdmin);

  if (!isOwner && !isAdmin) {
    console.log('[softDeleteVacationRequest] Permiso denegado para usuario:', dbUser.id);
    throw new HttpException('No tienes permiso para cancelar esta solicitud', HttpStatus.FORBIDDEN);
  }

  // 🔹 Marcar como eliminada
  request.deleted = true;
  await this.vacationRequestRepository.save(request);

  console.log('[softDeleteVacationRequest] Solicitud marcada como eliminada correctamente:', request.id);

  return { message: 'La solicitud fue cancelada/eliminada correctamente' };
}




  // Obtener Todas las solicitudes eliminadas
  async getDeletedVacationRequests(): Promise<(Omit<VacationRequest, 'user'> & { ci: string, username: string, fullname: string, department?: string, academicUnit?: string })[]> {
    const requests = await this.vacationRequestRepository.find({
      where: { deleted: true }, // 👈 Solo solicitudes eliminadas
      relations: ['user', 'user.department', 'user.academicUnit'],
    });

    return requests.map((request) => {
      const { user, ...requestWithoutSensitiveData } = request;

      const ci = user?.ci ?? 'N/A';
      const username = user?.username ?? 'N/A';
      const fullname = user?.fullName ?? 'N/A';
      const department = user?.department?.name ?? null;
      const academicUnit = user?.academicUnit?.name ?? null;

      return {
        ...requestWithoutSensitiveData,
        ci,
        username,
        fullname,
        department,
        academicUnit,
      };
    });
  }
  // En vacation-request.service.ts
async getPendingVacationRequestsForHR(): Promise<(Omit<VacationRequest, 'user'> & {
  ci: string;
  fullname: string;
  department?: string;
  academicUnit?: string;
})[]> {
  const requests = await this.vacationRequestRepository.find({
    where: [
      { approvedByHR: false, deleted: false },
      { approvedByHR: false, deleted: null },
    ],
    relations: ['user', 'user.department', 'user.academicUnit'],
  });

  console.log('Solicitudes pendientes de RRHH:', requests.length);

  return requests.map((request) => {
    const { user, ...rest } = request;
    return {
      ...rest,
      ci: user.ci,
      fullname: user.fullName,
      department: user.department?.name ?? null,
      academicUnit: user.academicUnit?.name ?? null,
    };
  });
}



  async createPastVacation(dto: CreatePastVacationDto) {
    const {
      userId,
      requestDate,
      startDate,
      endDate,
      position,
      status,
      managementPeriodStart,
      managementPeriodEnd,
    } = dto;

    // Validación de estados permitidos
    const allowedStatuses = ['AUTHORIZED', 'POSTPONED', 'DENIED', 'SUSPENDED'];
    if (!allowedStatuses.includes(status)) {
      throw new HttpException(
        `El estado '${status}' no es válido para una solicitud pasada.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validación de usuario
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new HttpException(
        `Usuario con ID ${userId} no encontrado.`,
        HttpStatus.NOT_FOUND
      );
    }

    // Validación de fechas
    const start = DateTime.fromISO(startDate, { zone: 'utc' });
    const end = DateTime.fromISO(endDate, { zone: 'utc' });

    if (!start.isValid || !end.isValid) {
      throw new HttpException(
        'Formato de fecha inválido. Use formato ISO (YYYY-MM-DD).',
        HttpStatus.BAD_REQUEST
      );
    }

    if (end < start) {
      throw new HttpException(
        'La fecha de inicio no puede ser posterior a la fecha de fin.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verificar solicitudes pendientes
    const allRequests = await this.vacationRequestRepository.find({
      where: { user: { id: user.id }, deleted: false },
      order: { requestDate: 'DESC' },
    });

    if (allRequests.some(r => r.status === 'PENDING')) {
      throw new HttpException(
        'No puedes registrar una solicitud pasada mientras exista una pendiente.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verificar solapamiento con otras solicitudes
    await ensureNoOverlappingVacations(
      this.vacationRequestRepository,
      user.id,
      start.toISODate(),
      end.toISODate()
    );

    // Calcular días de vacaciones
    const totalDays = await calculateVacationDays(
      start.toISODate(),
      end.toISODate(),
      this.nonHolidayService
    );

    // Calcular fecha de retorno
    const returnDate = await calculateReturnDate(
      end.toISODate(),
      totalDays,
      this.nonHolidayService
    );
    // Convertir fechas de inicio y fin en UTC, hora 00:00 (inicio del día)
    const startDateUTC = DateTime.fromISO(startDate, { zone: 'utc' }).startOf('day').toISO();
    const endDateUTC = DateTime.fromISO(endDate, { zone: 'utc' }).startOf('day').toISO();

    // requestDate puede ser opcional, si viene convertimos igual
    const requestDateUTC = requestDate
      ? DateTime.fromISO(requestDate, { zone: 'utc' }).startOf('day').toISO()
      : DateTime.now().setZone('utc').startOf('day').toISO();

    // returnDate viene de calculateReturnDate, que según tu código probablemente retorna fecha en formato ISO simple, convertimos igual:
    const returnDateUTC = DateTime.fromISO(returnDate, { zone: 'utc' }).startOf('day').toISO();

    // managementPeriodStart y managementPeriodEnd opcionales
    const managementStartUTC = managementPeriodStart
      ? DateTime.fromISO(managementPeriodStart, { zone: 'utc' }).startOf('day').toISO()
      : null;

    const managementEndUTC = managementPeriodEnd
      ? DateTime.fromISO(managementPeriodEnd, { zone: 'utc' }).startOf('day').toISO()
      : null;

    // Luego en el objeto a guardar:
    const vacationData = {
      user: { id: user.id },
      requestDate: requestDateUTC,
      startDate: startDateUTC,
      endDate: endDateUTC,
      totalDays,
      position,
      status,
      approvedByHR: true,
      approvedBySupervisor: true,
      approvedBy: { id: user.id },
      returnDate: returnDateUTC,
      managementPeriodStart: managementStartUTC,
      managementPeriodEnd: managementEndUTC,
      reviewDate: DateTime.now().setZone('utc').toISO(),
      isPast: true,
    };


    try {
      const vacation = this.vacationRequestRepository.create(vacationData);
      return await this.vacationRequestRepository.save(vacation);
    } catch (error) {
      throw new HttpException(
        'Error al guardar la solicitud de vacaciones pasada',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  // Eliminar sin considerar estado ni aprobaciones
async forceSoftDeleteVacationRequest(
  id: number,
  user: { id: number; role?: string }
): Promise<{ message: string }> {
  const request = await this.vacationRequestRepository.findOne({
    where: { id },
    relations: ['user'],
  });

  console.log('[forceSoftDelete] request:', request);

  if (!request) {
    throw new HttpException('Solicitud de vacaciones no encontrada', HttpStatus.NOT_FOUND);
  }

  if (request.deleted) {
    throw new HttpException('La solicitud ya fue eliminada previamente', HttpStatus.BAD_REQUEST);
  }

  console.log('[forceSoftDelete] user:', user);

  // Permitir solo al dueño o admin
  const isOwner = request.user.id === user.id;
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';

  if (!isOwner && !isAdmin) {
    console.log('[forceSoftDelete] Permiso denegado');
    throw new HttpException('No tienes permiso para eliminar esta solicitud', HttpStatus.FORBIDDEN);
  }

  request.deleted = true;
  await this.vacationRequestRepository.save(request);

  console.log('[forceSoftDelete] Solicitud eliminada correctamente');

  return { message: 'La solicitud fue eliminada correctamente (forzado)' };
}

}