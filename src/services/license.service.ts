import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, Repository } from 'typeorm';
import { License, LicenseType, TimeRequest } from 'src/entities/license.entity';
import { DateTime } from 'luxon';
import { User } from 'src/entities/user.entity';
import { LicenseResponseDto } from 'src/dto/license-response.dto';
import { UserService } from './user.service';
import { VacationService } from './vacation.service';
import { NotificationService } from './notification.service';
import toLocalDateOnly from 'src/utils/normalizaedDate';
import { NonHolidayService } from './nonholiday.service';
import { NonHoliday } from 'src/entities/nonholiday.entity';
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
    private readonly nonHolidayService: NonHolidayService
  ) { }
  async createLicense(userId: number, licenseData: Partial<License>): Promise<LicenseResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (!licenseData.startDate || !licenseData.endDate || !licenseData.licenseType || !licenseData.timeRequested) {
      throw new BadRequestException('Fechas, tipo de licencia y tiempo solicitado son requeridos');
    }

    this.validateLicenseEnums(licenseData);

    const startDate = new Date(licenseData.startDate);
    const endDate = new Date(licenseData.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Formato de fecha inválido (use YYYY-MM-DD)');
    }

    if (startDate > endDate) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio');
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


    const now = DateTime.local().setZone('America/La_Paz');
    const today = now.startOf('day');
    const cutoffTime = today.set({ hour: 20 });
    const startDateLuxon = DateTime.fromISO(licenseData.startDate).setZone('America/La_Paz');

    if (startDateLuxon < today || (startDateLuxon.hasSame(today, 'day') && now >= cutoffTime)) {
      throw new BadRequestException(
        'Solo puede solicitar licencias para hoy antes de las 20:00 o para fechas futuras'
      );
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const holidays = await this.nonHolidayRepository.find({
      where: { date: Between(startStr, endStr) }
    });

    const holidaysApplied: { date: string; year: number; description: string }[] = [];
    const ignoredWeekendHolidays: { date: string; description: string }[] = [];

    const holidayDatesMap = new Map<string, { date: string; description: string }>();
    for (const h of holidays) {
      const date = new Date(h.date);
      const isoDate = date.toISOString().split('T')[0];
      holidayDatesMap.set(date.toDateString(), { date: isoDate, description: h.description });
    }

    let totalDays = 0;

    const zone = 'America/La_Paz';


    if (licenseData.timeRequested === TimeRequest.HALF_DAY) {
      totalDays = 0.5;
    } else {
      let dateCursor = DateTime.fromISO(licenseData.startDate, { zone });
      const end = DateTime.fromISO(licenseData.endDate, { zone });

      while (dateCursor <= end) {
        const isoDateStr = dateCursor.toISODate(); // YYYY-MM-DD
        const dayOfWeek = dateCursor.weekday; // 1 = lunes, ..., 7 = domingo
        const isHoliday = holidayDatesMap.has(isoDateStr);

        console.log(`[DEBUG] Evaluando fecha: ${isoDateStr}`);
        console.log(`- Día de la semana: ${dayOfWeek} (${dateCursor.toFormat('cccc')})`);
        console.log(`- ¿Es feriado?: ${isHoliday}`);

        if (dayOfWeek < 6 && !isHoliday) {
          console.log(`✅ Día hábil contado (${totalDays + 1})`);
          totalDays++;
        }

        if (isHoliday) {
          const holiday = holidayDatesMap.get(isoDateStr);
          if (dayOfWeek >= 6) {
            ignoredWeekendHolidays.push({ date: isoDateStr, description: holiday.description });
          } else {
            holidaysApplied.push({
              date: isoDateStr,
              year: dateCursor.year,
              description: holiday.description
            });
          }
        }

        dateCursor = dateCursor.plus({ days: 1 });
      }
    }


    const maxDays = 5;
    if (totalDays > maxDays) {
      throw new BadRequestException(`No puede solicitar más de ${maxDays} días consecutivos (excluyendo feriados)`);
    }

    await this.validateNoExistingLicense(userId, licenseData.startDate, licenseData.endDate);

    const license = this.licenseRepository.create({
      ...licenseData,
      user,
      totalDays,
      issuedDate: new Date(),
      immediateSupervisorApproval: false,
      personalDepartmentApproval: false
    });

    const savedLicense = await this.licenseRepository.manager.transaction(
      async transactionalEntityManager => {
        return await transactionalEntityManager.save(license);
      }
    );

    await this.notificationService.notifyRelevantSupervisorsAndAdmins(
      `El usuario ${user.fullName} ha solicitado una licencia del ${licenseData.startDate} al ${licenseData.endDate} (${totalDays} días hábiles).`,
      user.id,
      'LICENSE',
      savedLicense.id  // ✅ Este es el ID correcto // si tienes el ID de la licencia para referenciar
    );


    return {
      ...this.mapLicenseToDto(savedLicense),
      message: `Licencia registrada del ${licenseData.startDate} al ${licenseData.endDate} (${totalDays} días hábiles).`,
      holidaysApplied: holidaysApplied.length > 0 ? holidaysApplied : undefined,
      ignoredWeekendHolidays: ignoredWeekendHolidays.length > 0 ? ignoredWeekendHolidays : undefined
    };
  }
  async findAllLicenses(): Promise<LicenseResponseDto[]> {
    const licenses = await this.licenseRepository.find({
      where: { deleted: false },
      relations: ['user'],
    });

    return licenses.map(license => this.mapLicenseToDto(license));
  }
  async findOneLicense(id: number): Promise<LicenseResponseDto> {
    const license = await this.licenseRepository.findOne({
      where: {
        id,
        deleted: false,
      },
      relations: ['user'],
    });

    if (!license) {
      throw new NotFoundException('Licencia no encontrada');
    }

    return this.mapLicenseToDto(license);
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
  // Verificar si el usuario existe
  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  // Buscar licencias no eliminadas asociadas al usuario
  const licenses = await this.licenseRepository.find({
    where: {
      user: { id: userId },
      deleted: false,
    },
    order: { issuedDate: 'DESC' },
  });

  if (!licenses || licenses.length === 0) {
    throw new BadRequestException('El usuario no tiene licencias activas registradas');
  }

  return licenses.map(this.mapLicenseToDto);
}
  // Calcula la cantidad total de licencias activas (no eliminadas) y los días usados por un usuario en un rango de fechas
  async getTotalLicensesForUser(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{ totalLicenses: number; totalDays: number }> {
    const startDateTime = DateTime.fromJSDate(startDate).startOf('day');
    const endDateTime = DateTime.fromJSDate(endDate).startOf('day').plus({ days: 1 }); // Incluye el último día

    const licenses = await this.licenseRepository.createQueryBuilder('license')
      .where('license.user.id = :userId', { userId })
      .andWhere('license.startDate >= :startDate', { startDate: startDateTime.toISODate() })
      .andWhere('license.endDate <= :endDate', { endDate: endDateTime.toISODate() })
      .andWhere('license.deleted = false') // Filtra licencias no eliminadas
      .getMany();

    let totalDays = 0;
    for (const license of licenses) {
      const start = DateTime.fromJSDate(new Date(license.startDate)).startOf('day');
      const end = DateTime.fromJSDate(new Date(license.endDate)).startOf('day').plus({ days: 1 });

      const days = end.diff(start, 'days').days;

      let additionalDays = 0;
      if (license.timeRequested === TimeRequest.HALF_DAY) {
        additionalDays = 0.5;
      } else if (
        license.timeRequested === TimeRequest.FULL_DAY ||
        license.timeRequested === TimeRequest.MULTIPLE_DAYS
      ) {
        additionalDays = days;
      }

      totalDays += additionalDays;
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
    const endDateTime = DateTime.fromJSDate(endDate).startOf('day').plus({ days: 1 }); // Incluye el último día

    try {
      // Filtrar solo las licencias autorizadas
      const licenses = await this.licenseRepository.createQueryBuilder('license')
        .leftJoinAndSelect('license.user', 'user')
        .where('license.user.id = :userId', { userId })
        .andWhere('license.startDate >= :startDate', { startDate: startDateTime.toISODate() })
        .andWhere('license.endDate < :endDate', { endDate: endDateTime.toISODate() })
        .andWhere('license.deleted = false')
        .andWhere('license.immediateSupervisorApproval = :approved', { approved: true })
        .andWhere('license.personalDepartmentApproval = :approved', { approved: true })
        .getMany();

      // Usar directamente totalDays de cada licencia
      const totalAuthorizedDays = licenses.reduce((sum, license) => {
        return sum + Number(license.totalDays ?? 0);
      }, 0);


      const requests = licenses.map(license => this.mapLicenseToDto(license));

      return {
        totalAuthorizedDays,
        requests,
      };

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

    if (!supervisor) {
      throw new Error('Supervisor not found');
    }

    const tipoEmpleado = supervisor.tipoEmpleado;

    let licenses;

    if (tipoEmpleado === 'ADMINISTRATIVO') {
      if (!supervisor.department) {
        throw new Error('Supervisor does not belong to any department');
      }

      licenses = await this.licenseRepository.createQueryBuilder('license')
        .leftJoinAndSelect('license.user', 'user')
        .where('user.departmentId = :departmentId', { departmentId: supervisor.department.id })
        .getMany();

    } else if (tipoEmpleado === 'DOCENTE') {
      if (!supervisor.academicUnit) {
        throw new Error('Supervisor does not belong to any academic unit');
      }

      licenses = await this.licenseRepository.createQueryBuilder('license')
        .leftJoinAndSelect('license.user', 'user')
        .where('user.academicUnitId = :academicUnitId', { academicUnitId: supervisor.academicUnit.id })
        .getMany();

    } else {
      throw new Error('Tipo de empleado del supervisor no reconocido');
    }

    return licenses.map(license => ({
      id: license.id,
      licenseType: license.licenseType,
      timeRequested: license.timeRequested,
      startDate: license.startDate,
      endDate: license.endDate,
      totalDays: license.totalDays,
      issuedDate: license.issuedDate,
      immediateSupervisorApproval: license.immediateSupervisorApproval,
      personalDepartmentApproval: license.personalDepartmentApproval,
      userId: license.user.id,
    }));
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

        // 3.5. Validación de solapamiento con licencias existentes
        await this.validateNoExistingLicense(userId, licenseData.startDate, licenseData.endDate);

        // 3.6. Validación de solapamiento dentro del mismo lote
        for (const otherLicense of validatedLicenses) {
          const otherStart = new Date(otherLicense.startDate);
          const otherEnd = new Date(otherLicense.endDate);

          if (this.datesOverlap(startDate, endDate, otherStart, otherEnd)) {
            throw new Error(`La licencia se solapa con otra en el mismo lote (${otherLicense.startDate} - ${otherLicense.endDate})`);
          }
        }

        // 3.7. Cálculo de días totales según tipo de solicitud
        let totalDays = 0;
        switch (licenseData.timeRequested) {
          case TimeRequest.HALF_DAY:
            totalDays = 0.5;
            break;
          case TimeRequest.FULL_DAY:
            totalDays = 1;
            break;
          case TimeRequest.MULTIPLE_DAYS:
            totalDays = this.countWeekdays(startDate, endDate);

            break;
          default:
            throw new Error('Tipo de tiempo solicitado no reconocido');
        }

        // 3.8. Preparar entidad validada
        validatedLicenses.push({
          ...licenseData,
          startDate: licenseData.startDate,
          endDate: licenseData.endDate,
          totalDays,
          user,
          immediateSupervisorApproval: true, // Por defecto no aprobado
          personalDepartmentApproval: true // Por defecto no aprobado
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
        deleted: false, // Excluir licencias eliminadas lógicamente
      },
      relations: ['user', 'user.department', 'user.academicUnit'],
    });

    return licenses.map((license) => {
      const { user, ...rest } = license;
      return {
        ...rest,
        ci: user.ci,
        fullname: user.fullName,
        department: user.department?.name ?? null,
        academicUnit: user.academicUnit?.name ?? null,
      };
    });
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
      deleted:license.deleted
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


}