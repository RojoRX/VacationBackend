import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, Repository } from 'typeorm';
import { HalfDayType, License, LicenseType, TimeRequest } from 'src/entities/license.entity';
import { DateTime } from 'luxon';
import { User } from 'src/entities/user.entity';
import { LicenseResponseDto } from 'src/dto/license-response.dto';
import { UserService } from './user.service';
import { VacationService } from './vacation.service';
import { NotificationService } from './notification.service';
import toLocalDateOnly from 'src/utils/normalizaedDate';
import { NonHolidayService } from './nonholiday.service';
import { NonHoliday } from 'src/entities/nonholiday.entity';
import { parseISO, format, setYear, getYear, eachDayOfInterval } from 'date-fns';
import { LicenseUtilsService } from './license-utils.service';
@Injectable()
export class LicenseService {
  constructor(
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
    @InjectRepository(NonHoliday)
    private readonly nonHolidayRepository: Repository<NonHoliday>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private userService: UserService,
    @Inject(forwardRef(() => VacationService))
    private readonly vacationService: VacationService,
    private readonly notificationService: NotificationService,
    private readonly nonHolidayService: NonHolidayService,
    private readonly licenseUtilsService: LicenseUtilsService,
  ) { }
  async createLicense(userId: number, licenseData: Partial<License>): Promise<LicenseResponseDto> {
    // Validaciones básicas de usuario y datos requeridos
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (!licenseData.startDate || !licenseData.endDate || !licenseData.licenseType || !licenseData.timeRequested) {
      throw new BadRequestException('Fechas, tipo de licencia y tiempo solicitado son requeridos');
    }

    // Validar enums
    this.validateLicenseEnums(licenseData);

    // Validación de fechas
    const startDate = new Date(licenseData.startDate);
    const endDate = new Date(licenseData.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Formato de fecha inválido (use YYYY-MM-DD)');
    }

    if (startDate > endDate) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio');
    }
    // 🔹 Validar coherencia de medios días
    // Para licencias de medio día
    if (licenseData.timeRequested === TimeRequest.HALF_DAY) {
      // Asegurarse de que startDate === endDate
      licenseData.endDate = licenseData.startDate;
      // Asegurarse de que ambos turnos tengan el mismo valor
      licenseData.endHalfDay = licenseData.startHalfDay;
    }

    // Validación de coherencia de medios días solo para rangos >1 día

    // Validar que no existan solicitudes pendientes
    const pendingLicense = await this.licenseRepository.findOne({
      where: {
        user: { id: userId },
        immediateSupervisorApproval: false,
        personalDepartmentApproval: false,
        deleted: false
      },
      order: { issuedDate: 'DESC' }
    });

    if (pendingLicense) {
      throw new BadRequestException(
        'No puede crear una nueva licencia mientras tenga otra pendiente de aprobación.'
      );
    }
    if (
      licenseData.timeRequested === TimeRequest.MULTIPLE_DAYS &&
      licenseData.startDate === licenseData.endDate
    ) {
      throw new BadRequestException('Para licencias de "Varios días" debe seleccionar un rango de fechas diferente');
    }

    if (licenseData.timeRequested === TimeRequest.HALF_DAY && licenseData.startDate !== licenseData.endDate) {
      throw new BadRequestException('La licencia de medio día debe tener la misma fecha de inicio y fin');
    }

    // 🧩 Validar medios días para HALF_DAY
    if (licenseData.timeRequested === TimeRequest.HALF_DAY) {
      if (!licenseData.startHalfDay) {
        throw new BadRequestException('Debe indicar si el medio día es por la mañana o por la tarde');
      }

      if (![HalfDayType.MORNING, HalfDayType.AFTERNOON].includes(licenseData.startHalfDay)) {
        throw new BadRequestException('Valor de startHalfDay inválido (use "Media Mañana" o "Media Tarde")');
      }

      // 🔹 Asegurar que endHalfDay sea igual al turno seleccionado
      licenseData.endHalfDay = licenseData.startHalfDay;
      // 🔹 Asegurar que la fecha de fin sea igual a la de inicio
      licenseData.endDate = licenseData.startDate;
    }


    // Validación de fecha/hora para solicitudes
    const now = DateTime.local().setZone('America/La_Paz');
    const today = now.startOf('day');
    const cutoffTime = today.set({ hour: 20 });
    const startDateLuxon = DateTime.fromISO(licenseData.startDate).setZone('America/La_Paz');

    if (startDateLuxon < today || (startDateLuxon.hasSame(today, 'day') && now >= cutoffTime)) {
      throw new BadRequestException(
        'Solo puede solicitar licencias para hoy antes de las 20:00 o para fechas futuras'
      );
    }

    // VALIDACIÓN DE DÍAS DISPONIBLES PARA VACACIONES
    if (licenseData.licenseType === LicenseType.VACATION) {
      // 1. Obtener fecha de ingreso ajustada al año actual
      const fechaIngreso = parseISO(user.fecha_ingreso);
      const solicitudDate = parseISO(licenseData.startDate);

      // Fecha del aniversario en el año de la solicitud
      const gestionStart = setYear(fechaIngreso, solicitudDate.getFullYear());

      // Si la solicitud es antes del aniversario, la gestión aún no se completó → usamos el año siguiente
      let endDateForDebtCalculation: Date;
      if (solicitudDate < gestionStart) {
        endDateForDebtCalculation = setYear(fechaIngreso, solicitudDate.getFullYear() + 1);
      } else {
        endDateForDebtCalculation = setYear(fechaIngreso, solicitudDate.getFullYear() + 1);
      }

      const endDateForDebtCalculationStr = format(endDateForDebtCalculation, 'yyyy-MM-dd');


      console.log(`Mandando esta fecha para licencias ${endDateForDebtCalculation}`)
      // 2. Calcular días disponibles
      const debtResult = await this.vacationService.calculateAccumulatedDebt(
        user.ci,
        endDateForDebtCalculationStr
      );


      // 3. Obtener días disponibles de la última gestión (año actual)
      const lastGestion = debtResult.detalles[debtResult.detalles.length - 1];
      const diasDisponibles = lastGestion?.diasDisponibles ?? 0;

      console.log(`[DEBUG] Días disponibles para VACACION: ${diasDisponibles}`);

      // 4. Validar según el tipo de tiempo solicitado
      if (licenseData.timeRequested === TimeRequest.HALF_DAY) {
        if (diasDisponibles < 0.5) {
          throw new BadRequestException(
            `No tiene suficientes días disponibles (${diasDisponibles}) para solicitar medio día de vacaciones`
          );
        }
      } else {
        // Calcular días totales solicitados
        const totalRequestedDays = await this.calculateRequestedDays(licenseData);

        if (totalRequestedDays > diasDisponibles) {
          throw new BadRequestException(
            `Solicitó ${totalRequestedDays} día(s) pero solo tiene ${diasDisponibles} día(s) disponibles`
          );
        }

      }
    }

    // Cálculo de días hábiles y feriados
    // Cálculo de días hábiles y feriados
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // ==== CÁLCULO CORREGIDO DE DÍAS PARA MULTIPLE_DAYS ====
    // ALTERNATIVA: Si quieres que cada "media jornada" cuente como 0.5 días completos
let totalDays = 0;
const startHalfDay = licenseData.startHalfDay ?? HalfDayType.NONE;
const endHalfDay = licenseData.endHalfDay ?? HalfDayType.NONE;

const zone = 'America/La_Paz';
let cursor = DateTime.fromISO(licenseData.startDate, { zone }).startOf('day');
const endDateLux = DateTime.fromISO(licenseData.endDate, { zone }).startOf('day');

while (cursor <= endDateLux) {
    const weekday = cursor.weekday;
    if (weekday >= 1 && weekday <= 5) {
        if (cursor.hasSame(DateTime.fromISO(licenseData.startDate), 'day')) {
            // Primer día
            totalDays += (startHalfDay === HalfDayType.NONE) ? 1 : 0.5;
        } else if (cursor.hasSame(DateTime.fromISO(licenseData.endDate), 'day')) {
            // Último día
            totalDays += (endHalfDay === HalfDayType.NONE) ? 1 : 0.5;
        } else {
            // Días intermedios (siempre completos)
            totalDays += 1;
        }
    }
    cursor = cursor.plus({ days: 1 });
}

totalDays = Math.max(totalDays, 0.5);

    // Validación de máximo de días consecutivos
    const maxDays = 5;
    if (totalDays > maxDays) {
      throw new BadRequestException(`No puede solicitar más de ${maxDays} días consecutivos (excluyendo feriados)`);
    }

    // Validar que no existan licencias solapadas
    await this.validateNoExistingLicense(userId, licenseData.startDate, licenseData.endDate);

    // Crear y guardar la licencia
    // 🔹 Asegurar que los valores de medios días se guarden correctamente
    const license = this.licenseRepository.create({
      ...licenseData,
      user,
      totalDays,
      issuedDate: new Date(),
      immediateSupervisorApproval: false,
      personalDepartmentApproval: false,
      // 🔹 Forzar la asignación explícita
      startHalfDay: licenseData.startHalfDay || HalfDayType.NONE,
      endHalfDay: licenseData.endHalfDay || HalfDayType.NONE
    });

    const savedLicense = await this.licenseRepository.manager.transaction(
      async transactionalEntityManager => {
        return await transactionalEntityManager.save(license);
      }
    );

    // Notificar a supervisores y administradores
    await this.notificationService.notifyRelevantSupervisorsAndAdmins(
      `El usuario ${user.fullName} ha solicitado una licencia del ${licenseData.startDate} al ${licenseData.endDate} (${totalDays} días hábiles).`,
      user.id,
      'LICENSE',
      savedLicense.id
    );

    return {
      ...this.mapLicenseToDto(savedLicense),
      message: `Licencia registrada del ${licenseData.startDate} al ${licenseData.endDate} (${totalDays} días hábiles).`
    };

  }

  async findOneLicense(id: number): Promise<LicenseResponseDto> {
    const license = await this.licenseRepository.findOne({
      where: { id, deleted: false },
      relations: ['user', 'approvedBySupervisor'],
    });

    if (!license) throw new NotFoundException('Licencia no encontrada');

    // Usamos el método auxiliar
    return this.licenseUtilsService.mapLicenseToDtoWithHolidays(license);
  }

  async findAllLicenses(): Promise<LicenseResponseDto[]> {
    const licenses = await this.licenseRepository.find({
      where: { deleted: false },
      relations: ['user', 'approvedBySupervisor'],
    });

    return Promise.all(
      licenses.map(license => this.licenseUtilsService.mapLicenseToDtoWithHolidays(license))
    );
  }




  async updateLicense(id: number, updateData: Partial<License>): Promise<LicenseResponseDto> {
    await this.licenseRepository.update(id, updateData);
    const updatedLicense = await this.findOneLicense(id);
    return updatedLicense;
  }
  // Marca una licencia como eliminada (borrado lógico) si el usuario es ADMIN o el dueño de la licencia
  async removeLicense(licenseId: number, requestingUserId: number): Promise<void> {
    const license = await this.licenseRepository.findOne({
      where: { id: licenseId },
      relations: ['user'],
    });

    if (!license) {
      throw new NotFoundException('Licencia no encontrada');
    }

    if (license.deleted) {
      throw new BadRequestException('La licencia ya fue eliminada');
    }

    // Obtener el usuario que realiza la solicitud
    const requestingUser = await this.userRepository.findOne({ where: { id: requestingUserId } });

    if (!requestingUser) {
      throw new NotFoundException('Usuario solicitante no encontrado');
    }

    // Verificar si es administrador o dueño de la licencia
    const isAdmin = requestingUser.role === 'ADMIN';
    const isOwner = requestingUser.id === license.user.id;

    if (!isAdmin && !isOwner) {
      throw new BadRequestException('No tiene permiso para eliminar esta licencia');
    }

    // Marcar como eliminada
    license.deleted = true;
    await this.licenseRepository.save(license);
  }
  // Retorna todas las licencias activas (no eliminadas) asociadas a un usuario dado
  async getAllLicensesForUser(userId: number): Promise<LicenseResponseDto[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const licenses = await this.licenseRepository.find({
      where: {
        user: { id: userId },
        deleted: false,
      },
      order: { issuedDate: 'DESC' },
      relations: ['user', 'approvedBySupervisor'], // agregar relaciones necesarias
    });

    if (!licenses || licenses.length === 0) {
      throw new BadRequestException('El usuario no tiene licencias activas registradas');
    }

    // 🔹 Recalculamos totalDays y agregamos feriados detectados para cada licencia
    return Promise.all(
      licenses.map(license => this.licenseUtilsService.mapLicenseToDtoWithHolidays(license))
    );
  }

  // Calcula la cantidad total de licencias activas (no eliminadas) y los días usados por un usuario en un rango de fechas
  async getTotalLicensesForUser(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{ totalLicenses: number; totalDays: number }> {
    const startDateTime = DateTime.fromJSDate(startDate).startOf('day');
    const endDateTime = DateTime.fromJSDate(endDate).startOf('day');

    const licenses = await this.licenseRepository.find({
      where: {
        user: { id: userId },
        startDate: Between(startDateTime.toISODate(), endDateTime.toISODate()),
        deleted: false,
      },
      relations: ['user'],
    });

    let totalDays = 0;

    for (const license of licenses) {
      // 🔹 Usamos el método auxiliar para calcular días reales considerando feriados y medias jornadas
      const { totalDays: effectiveDays } =
        await this.licenseUtilsService.calculateEffectiveDaysWithHolidays(
          license.startDate,
          license.endDate,
          license.startHalfDay,
          license.endHalfDay,
        );

      totalDays += effectiveDays;
    }

    return {
      totalLicenses: licenses.length,
      totalDays,
    };
  }


  async getTotalAuthorizedLicensesForUser(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{ totalAuthorizedDays: number; requests: LicenseResponseDto[] }> {
    const startDateTime = DateTime.fromJSDate(startDate).startOf('day');
    const endDateTime = DateTime.fromJSDate(endDate).startOf('day');

    try {
      // Filtrar solo licencias aprobadas y no eliminadas
      const licenses = await this.licenseRepository.find({
        where: {
          user: { id: userId },
          startDate: Between(startDateTime.toISODate(), endDateTime.toISODate()),
          deleted: false,
          immediateSupervisorApproval: true,
          personalDepartmentApproval: true,
        },
        relations: ['user', 'approvedBySupervisor'],
      });

      let totalAuthorizedDays = 0;

      // Recalculamos totalDays dinámico usando el servicio auxiliar
      const requests: LicenseResponseDto[] = await Promise.all(
        licenses.map(async (license) => {
          const dto = await this.licenseUtilsService.mapLicenseToDtoWithHolidays(license);
          totalAuthorizedDays += dto.totalDays;
          return dto;
        })
      );

      return { totalAuthorizedDays, requests };

    } catch (error) {
      console.error('Error al obtener licencias autorizadas:', error);
      throw new Error('Error al obtener licencias autorizadas');
    }
  }



  // Método para obtener las licencias del departamento del supervisor
  async findLicensesByDepartment(supervisorId: number): Promise<LicenseResponseDto[]> {
    const supervisor = await this.userService.findById(supervisorId, {
      relations: ['department', 'academicUnit'],
    });

    if (!supervisor) throw new Error('Supervisor not found');

    const tipoEmpleado = supervisor.tipoEmpleado;

    let licenses: License[] = [];

    if (tipoEmpleado === 'ADMINISTRATIVO') {
      if (!supervisor.department) throw new Error('Supervisor does not belong to any department');

      licenses = await this.licenseRepository.find({
        where: { user: { department: { id: supervisor.department.id } } },
        relations: ['user', 'approvedBySupervisor'],
      });

    } else if (tipoEmpleado === 'DOCENTE') {
      if (!supervisor.academicUnit) throw new Error('Supervisor does not belong to any academic unit');

      licenses = await this.licenseRepository.find({
        where: { user: { academicUnit: { id: supervisor.academicUnit.id } } },
        relations: ['user', 'approvedBySupervisor'],
      });

    } else {
      throw new Error('Tipo de empleado del supervisor no reconocido');
    }

    // 🔹 Recalculamos totalDays dinámico y mapeamos al DTO
    return Promise.all(
      licenses.map(license => this.licenseUtilsService.mapLicenseToDtoWithHolidays(license))
    );
  }

  // Método para que un supervisor apruebe o rechace una licencia
  async approveLicense(
    licenseId: number,
    supervisorId: number,
    approval: boolean
  ): Promise<LicenseResponseDto> {
    const license = await this.licenseRepository.findOne({
      where: { id: licenseId },
      relations: ['user', 'user.department', 'user.academicUnit'],
    });

    if (!license) {
      throw new BadRequestException('License not found');
    }

    if (license.immediateSupervisorApproval || license.personalDepartmentApproval) {
      throw new BadRequestException('La licencia ya fue revisada y no puede modificarse nuevamente.');
    }


    const supervisor = await this.userRepository.findOne({
      where: { id: supervisorId },
      relations: ['department', 'academicUnit'],
    });

    if (!supervisor) {
      throw new BadRequestException('Supervisor not found');
    }

    const tipoSupervisor = supervisor.tipoEmpleado;

    // Validar pertenencia a departamento o unidad académica
    if (tipoSupervisor === 'ADMINISTRATIVO') {
      if (!supervisor.department || !license.user.department || supervisor.department.id !== license.user.department.id) {
        throw new BadRequestException('No autorizado: el supervisor no pertenece al mismo departamento que el usuario.');
      }
    } else if (tipoSupervisor === 'DOCENTE') {
      if (!supervisor.academicUnit || !license.user.academicUnit || supervisor.academicUnit.id !== license.user.academicUnit.id) {
        throw new BadRequestException('No autorizado: el supervisor no pertenece a la misma unidad académica que el usuario.');
      }
    } else {
      throw new BadRequestException('Tipo de empleado del supervisor no reconocido.');
    }

    // Actualizar estado de aprobación
    license.immediateSupervisorApproval = approval;
    license.approvedBySupervisor = approval ? supervisor : null;

    await this.licenseRepository.save(license);

    const message = approval
      ? `Tu licencia fue aprobada por el supervisor ${supervisor.fullName}.`
      : `Tu licencia fue rechazada por el supervisor ${supervisor.fullName}.`;

    await this.notificationService.notifyUser({
      recipientId: license.user.id,
      message,
      senderId: supervisor.id,
      resourceType: 'LICENSE',        // opcional, si quieres indicar que es sobre una licencia
      resourceId: license.id,         // opcional, para referencia
    });

    return {
      id: license.id,
      licenseType: license.licenseType,
      timeRequested: license.timeRequested,
      startDate: license.startDate,
      endDate: license.endDate,
      issuedDate: license.issuedDate,
      immediateSupervisorApproval: license.immediateSupervisorApproval,
      personalDepartmentApproval: license.personalDepartmentApproval,
      userId: license.user.id,
      totalDays: license.totalDays,
      userDepartmentId: license.user.department?.id,
      userDepartmentName: license.user.department?.name,
      approvedBySupervisorId: approval ? supervisor.id : undefined,
      approvedBySupervisorName: approval ? supervisor.fullName : undefined,
      supervisorDepartmentId: approval ? supervisor.department?.id : undefined,
      supervisorDepartmentName: approval ? supervisor.department?.name : undefined,
      deleted: license.deleted,
    };
  }
  // Método para que un usuario con rol ADMIN apruebe o rechace una licencia desde el departamento de personal
  // Método para que un usuario con rol ADMIN apruebe o rechace una licencia desde el departamento de personal
  async updatePersonalDepartmentApproval(
    licenseId: number,
    userId: number, // quien realiza la aprobación
    approval: boolean
  ): Promise<License> {
    // Buscar la licencia por ID
    const license = await this.licenseRepository.findOne({
      where: { id: licenseId },
      relations: ['user'],
    });

    if (!license || !license.user) {
      throw new BadRequestException('Licencia o usuario asociado no encontrado');
    }

    // Buscar al usuario que intenta aprobar/rechazar
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Verificar si el usuario tiene el rol ADMIN
    if (user.role !== 'ADMIN') {
      throw new BadRequestException('No autorizado: solo usuarios con rol ADMIN pueden realizar esta acción.');
    }

    // Verificar si ya fue aprobada o rechazada por el departamento de personal
    if (license.personalDepartmentApproval === true) {
      throw new BadRequestException('La aprobación del departamento de personal ya fue realizada.');
    }

    // Verificar si ya fue aprobada o rechazada por el supervisor inmediato
    if (license.immediateSupervisorApproval === true) {
      throw new BadRequestException('La aprobación del departamento de personal ya fue realizada.');
    }


    // Actualizar ambos campos de aprobación
    license.personalDepartmentApproval = approval;
    license.immediateSupervisorApproval = approval;

    // Guardar y devolver la licencia actualizada
    const updatedLicense = await this.licenseRepository.save(license);

    // Notificar al usuario sobre la decisión
    const message = approval
      ? `Tu licencia fue aprobada por el departamento de personal y tu supervisor.`
      : `Tu licencia fue rechazada por el departamento de personal y tu supervisor.`;

    await this.notificationService.notifyUser({
      recipientId: license.user.id,
      message,
      senderId: user.id,
      resourceType: 'LICENSE',   // opcional
      resourceId: license.id,    // opcional
    });

    return updatedLicense;
  }
  async createMultipleLicenses(userId: number, licensesData: Partial<License>[]): Promise<LicenseResponseDto[]> {
    // 1. Validación inicial - Usuario existe
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // 2. Validación - Datos de entrada
    if (!licensesData || !Array.isArray(licensesData)) {
      throw new BadRequestException('Se requiere un array de licencias');
    }

    // 3. Preprocesamiento y validación individual
    const validatedLicenses = [];
    const errors: { index: number; message: string }[] = [];

    for (const [index, licenseData] of licensesData.entries()) {
      try {
        // 3.1. Validación de campos requeridos
        if (!licenseData.startDate || !licenseData.endDate) {
          throw new Error('Fechas de inicio y fin son requeridas');
        }

        // 3.2. Validación de formato de fechas
        let startDate: Date;
        let endDate: Date;

        try {
          const [startYear, startMonth, startDay] = (licenseData.startDate as string).split('-').map(Number);
          const [endYear, endMonth, endDay] = (licenseData.endDate as string).split('-').map(Number);

          startDate = new Date(startYear, startMonth - 1, startDay);
          endDate = new Date(endYear, endMonth - 1, endDay);
        } catch {
          throw new Error('Formato de fecha inválido (use YYYY-MM-DD)');
        }

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Formato de fecha inválido (use YYYY-MM-DD)');
        }

        // 3.3. Validación de rango de fechas
        if (startDate > endDate) {
          throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio');
        }

        // 3.4. Validación de enums
        if (licenseData.licenseType && !Object.values(LicenseType).includes(licenseData.licenseType)) {
          throw new Error('Tipo de licencia no válido');
        }

        if (licenseData.timeRequested && !Object.values(TimeRequest).includes(licenseData.timeRequested)) {
          throw new Error('Tipo de tiempo solicitado no válido');
        }
        // 🔹 Manejo de medio día: asegurar mismo turno y fecha de inicio = fin
        if (licenseData.timeRequested === TimeRequest.HALF_DAY) {
          if (!licenseData.startHalfDay || ![HalfDayType.MORNING, HalfDayType.AFTERNOON].includes(licenseData.startHalfDay)) {
            throw new Error('Debe indicar si el medio día es por la mañana o por la tarde');
          }
          licenseData.endHalfDay = licenseData.startHalfDay;
          licenseData.endDate = licenseData.startDate;
        }
        // 3.5. Validación de solapamiento con licencias existentes
        await this.validateNoExistingLicense(userId, licenseData.startDate, licenseData.endDate);
        // 3.6. Validación de solapamiento dentro del mismo lote (robusta)
        for (const otherLicense of validatedLicenses) {
          if (licenseData === otherLicense) continue; // Saltar mismo objeto

          // Generar arrays de días ocupados para cada licencia
          const getOccupiedDays = (license: Partial<License>) => {
            const start = new Date(license.startDate);
            const end = new Date(license.endDate);
            const days: { date: string; half?: HalfDayType }[] = [];

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dayStr = d.toISOString().split('T')[0];
              if (license.timeRequested === TimeRequest.HALF_DAY) {
                days.push({ date: dayStr, half: license.startHalfDay });
              } else {
                days.push({ date: dayStr });
              }
            }
            return days;
          };

          const currentDays = getOccupiedDays(licenseData);
          const otherDays = getOccupiedDays(otherLicense);

          // Comparar cada día del currentDays con otherDays
          for (const c of currentDays) {
            const conflict = otherDays.find(o => o.date === c.date && (!c.half || !o.half || c.half === o.half));
            if (conflict) {
              throw new Error(
                `La licencia (${licenseData.timeRequested}${c.half ? ' ' + c.half : ''}) se solapa con otra licencia (${otherLicense.timeRequested}${conflict.half ? ' ' + conflict.half : ''}) en la misma fecha (${c.date})`
              );
            }
          }
        }

        // 3.7. Cálculo de días totales según tipo de solicitud y medios días
        let totalDays = 0;

        const startHalfDay = licenseData.startHalfDay || 'Completo';
        const endHalfDay = licenseData.endHalfDay || 'Completo';

        // Validaciones medias días
        if (!['Completo', 'Media Mañana', 'Media Tarde'].includes(startHalfDay)) {
          throw new Error('startHalfDay inválido');
        }
        if (licenseData.timeRequested !== TimeRequest.HALF_DAY) {
          if (!['Completo', 'Media Mañana'].includes(endHalfDay)) {
            throw new Error('endHalfDay inválido (solo Completo o Media Mañana en múltiples días)');
          }
        }


        switch (licenseData.timeRequested) {
          case TimeRequest.HALF_DAY:
            totalDays = 0.5;
            break;
          case TimeRequest.FULL_DAY:
            totalDays = 1;
            break;
          case TimeRequest.MULTIPLE_DAYS:
            totalDays = this.countWeekdays(startDate, endDate);
            // Ajuste por medios días
            if (startHalfDay !== 'Completo') totalDays -= 0.5;
            if (endHalfDay !== 'Completo') totalDays -= 0.5;
            totalDays = Math.max(totalDays, 0.5);
            break;
          default:
            throw new Error('Tipo de tiempo solicitado no reconocido');
        }

        // 3.8. Preparar entidad validada incluyendo medios días
        validatedLicenses.push({
          ...licenseData,
          startDate: licenseData.startDate,
          endDate: licenseData.endDate,
          totalDays,
          startHalfDay,
          endHalfDay,
          user,
          immediateSupervisorApproval: true,
          personalDepartmentApproval: true
        });


      } catch (error) {
        errors.push({
          index: index + 1,
          message: error.message
        });
      }
    }

    // 4. Validación global - Si hay errores, no continuar
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Errores en las licencias',
        details: errors,
        metadata: {
          totalLicenses: licensesData.length,
          validLicenses: validatedLicenses.length,
          invalidLicenses: errors.length
        }
      });
    }

    // 5. Guardado en transacción (todo o nada)
    return this.licenseRepository.manager.transaction(async transactionalEntityManager => {
      const savedLicenses: License[] = [];

      for (const validLicense of validatedLicenses) {
        const licenseEntity = transactionalEntityManager.create(License, validLicense);
        const savedLicense = await transactionalEntityManager.save(licenseEntity);
        savedLicenses.push(savedLicense);
      }

      return savedLicenses.map(license => this.mapLicenseToDto(license));
    });
  }
  // Retorna licencias pendientes de aprobación por el departamento de personal (solo las no eliminadas)
  async getPendingLicensesForHR(): Promise<(Omit<License, 'user'> & {
    ci: string;
    fullname: string;
    department?: string;
    academicUnit?: string;
  })[]> {
    const licenses = await this.licenseRepository.find({
      where: {
        personalDepartmentApproval: false,
        deleted: false,
      },
      relations: ['user', 'user.department', 'user.academicUnit'],
    });

    return Promise.all(
      licenses.map(async (license) => {
        // 🔹 Recalcular totalDays dinámico
        const { totalDays } = await this.licenseUtilsService.calculateEffectiveDaysWithHolidays(
          license.startDate,
          license.endDate,
          license.startHalfDay,
          license.endHalfDay
        );

        const { user, ...rest } = license;

        return {
          ...rest,
          totalDays, // valor recalculado
          ci: user.ci,
          fullname: user.fullName,
          department: user.department?.name ?? null,
          academicUnit: user.academicUnit?.name ?? null,
        };
      })
    );
  }

  //Obtener las licencias eliminadas
  async getDeletedLicenses(): Promise<LicenseResponseDto[]> {
    const deletedLicenses = await this.licenseRepository.find({
      where: { deleted: true },
      relations: ['user'],
      order: { issuedDate: 'DESC' }
    });

    return deletedLicenses.map(license => this.mapLicenseToDto(license));
  }

  //Eliminacion logica del administrador
  async adminRemoveLicense(licenseId: number): Promise<void> {
    const license = await this.licenseRepository.findOne({
      where: { id: licenseId },
    });

    if (!license) {
      throw new NotFoundException('Licencia no encontrada');
    }

    if (license.deleted) {
      throw new BadRequestException('La licencia ya fue eliminada');
    }

    // Marcar como eliminada
    license.deleted = true;
    await this.licenseRepository.save(license);
  }





  // Métodos auxiliares
  private mapLicenseToDto(license: License): LicenseResponseDto {
    // Depuración del objeto License


    if (!license.user) {
      console.error('License user is undefined during mapping for License ID:', license.id);
    }

    return {
      id: license.id,
      licenseType: license.licenseType,
      timeRequested: license.timeRequested,
      startDate: license.startDate,
      endDate: license.endDate,
      issuedDate: license.issuedDate,
      immediateSupervisorApproval: license.immediateSupervisorApproval,
      personalDepartmentApproval: license.personalDepartmentApproval,
      userId: license.user ? license.user.id : null, // Agregar control para caso en que user es undefined
      totalDays: license.totalDays,
      deleted: license.deleted
    };
  }
  private datesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return (start1 <= end2) && (end1 >= start2);
  }
  private calculateTotalDays(startDateStr: string, endDateStr: string): number {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // Incluye ambos días extremos
  }
  private getLicenseStatus(license: License): string {
    if (license.personalDepartmentApproval) return 'APROBADA';
    if (license.immediateSupervisorApproval) return 'PENDIENTE_APROBACION_DPTO';
    return 'PENDIENTE_APROBACION_SUPERVISOR';
  }
  // Verificar si ya existe una licencia en el rango de fechas
  private async validateNoExistingLicense(userId: number, startDateInput: string | Date, endDateInput: string | Date) {
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Fechas inválidas');
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const existingLicense = await this.licenseRepository.createQueryBuilder('license')
      .where('license.userId = :userId', { userId })
      .andWhere('license.deleted = false')
      .andWhere(new Brackets(qb => {
        qb.where('(license.startDate <= :endDate AND license.endDate >= :startDate)')
          .orWhere('license.startDate BETWEEN :startDate AND :endDate')
          .orWhere('license.endDate BETWEEN :startDate AND :endDate');
      }))
      .setParameters({
        startDate: startDateStr,
        endDate: endDateStr
      })
      .getOne();


    if (existingLicense) {
      throw new BadRequestException(
        `Ya existe una licencia registrada entre ${existingLicense.startDate} y ${existingLicense.endDate}`
      );
    }
  }

  private async calculateTotalDaysImproved(
    startDateStr: string,
    endDateStr: string,
    timeRequested: TimeRequest
  ): Promise<number> {
    const start = DateTime.fromISO(startDateStr).startOf('day');
    const end = DateTime.fromISO(endDateStr).startOf('day');

    if (timeRequested === TimeRequest.HALF_DAY) return 0.5;

    if (timeRequested === TimeRequest.FULL_DAY && start.hasSame(end, 'day')) return 1;

    const totalDays: DateTime[] = [];
    let current = start;

    while (current <= end) {
      totalDays.push(current);
      current = current.plus({ days: 1 });
    }

    // Obtener feriados del servicio
    const nonWorkingDates = await this.nonHolidayService.getNonWorkingDaysInRange(start.toISODate(), end.toISODate());
    const feriadosSet = new Set(nonWorkingDates);

    // Excluir los feriados del total de días
    const workingDays = totalDays.filter(d => !feriadosSet.has(d.toISODate()));

    return workingDays.length;
  }
  private countWeekdays(startDate: Date, endDate: Date): number {
    if (!startDate || !endDate) {
      console.error('❌ Fechas inválidas');
      return 0;
    }
    console.log("Recibi estos datos:" + startDate + " " + endDate)
    const pureStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const pureEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

    console.log(`Calculando días hábiles entre ${pureStart.toDateString()} y ${pureEnd.toDateString()}`);

    let count = 0;
    const current = new Date(pureStart);

    while (current <= pureEnd) {
      const day = current.getDay();
      const isWeekday = day >= 1 && day <= 5;

      console.log(`${current.toDateString()} (${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][day]}) → ${isWeekday ? 'Hábil' : 'Fin de semana'}`);

      if (isWeekday) count++;
      current.setDate(current.getDate() + 1);
    }

    console.log(`✅ Total días hábiles: ${count}`);
    return count;
  }
  // Validación de enums
  private validateLicenseEnums(licenseData: Partial<License>) {
    if (!Object.values(LicenseType).includes(licenseData.licenseType)) {
      throw new BadRequestException(`Valor inválido para licenseType: ${licenseData.licenseType}`);
    }

    if (!Object.values(TimeRequest).includes(licenseData.timeRequested)) {
      throw new BadRequestException(`Valor inválido para timeRequested: ${licenseData.timeRequested}`);
    }
  }
  // Cálculo de los días de licencia
  private calculateLicenseDays(licenseData: Partial<License>) {
    const startDate = DateTime.fromISO(licenseData.startDate).startOf('day');
    const endDate = DateTime.fromISO(licenseData.endDate).startOf('day');

    if (startDate > endDate) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }

    let totalDays = 0;
    if (licenseData.timeRequested === TimeRequest.HALF_DAY) {
      totalDays = 0.5;
    } else if (licenseData.timeRequested === TimeRequest.FULL_DAY || licenseData.timeRequested === TimeRequest.MULTIPLE_DAYS) {
      totalDays = endDate.diff(startDate, 'days').days + 1;
    }

    if (totalDays > 5) {
      throw new BadRequestException('La licencia no puede exceder los 5 días.');
    }

    if (licenseData.timeRequested === TimeRequest.HALF_DAY && totalDays > 1) {
      throw new BadRequestException('Cuando se solicita medio día, el rango de fechas debe ser de un solo día.');
    }

    return { startDate, endDate, totalDays };
  }

  private async calculateRequestedDays(licenseData: Partial<License>): Promise<number> {
    if (licenseData.timeRequested === TimeRequest.HALF_DAY) {
      return 0.5;
    }

    if (licenseData.timeRequested === TimeRequest.FULL_DAY) {
      return 1;
    }

    // Para MULTIPLE_DAYS calculamos la diferencia real en días hábiles
    const zone = 'America/La_Paz';
    let dateCursor = DateTime.fromISO(licenseData.startDate, { zone });
    const end = DateTime.fromISO(licenseData.endDate, { zone });
    let daysCount = 0;

    while (dateCursor <= end) {
      const dayOfWeek = dateCursor.weekday;
      if (dayOfWeek < 6) { // Lunes a Viernes
        daysCount++;
      }
      dateCursor = dateCursor.plus({ days: 1 });
    }

    return daysCount;
  }

}