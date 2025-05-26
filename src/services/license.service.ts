import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
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
    const dateCursor = new Date(startDate);

    while (dateCursor <= endDate) {
      const dateStr = dateCursor.toDateString();
      const isoDateStr = dateCursor.toISOString().split('T')[0];
      const dayOfWeek = dateCursor.getDay(); // 0 = domingo, 6 = sábado
      const isHoliday = holidayDatesMap.has(dateStr);

      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday) {
        totalDays++;
      }

      if (isHoliday) {
        const holiday = holidayDatesMap.get(dateStr);
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          ignoredWeekendHolidays.push({
            date: isoDateStr,
            description: holiday.description
          });
        } else {
          holidaysApplied.push({
            date: isoDateStr,
            year: new Date(holiday.date).getFullYear(),
            description: holiday.description
          });
        }
      }

      dateCursor.setDate(dateCursor.getDate() + 1);
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

    await this.notificationService.notifyAdminsAndSupervisors(
      `El usuario ${user.fullName} ha solicitado una licencia del ${licenseData.startDate} al ${licenseData.endDate} (${totalDays} días hábiles).`,
      user.id
    );

    return {
      ...this.mapLicenseToDto(savedLicense),
      message: `Licencia registrada del ${licenseData.startDate} al ${licenseData.endDate} (${totalDays} días hábiles).`,
      holidaysApplied: holidaysApplied.length > 0 ? holidaysApplied : undefined,
      ignoredWeekendHolidays: ignoredWeekendHolidays.length > 0 ? ignoredWeekendHolidays : undefined
    };
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

  async findAllLicenses(): Promise<LicenseResponseDto[]> {
    const licenses = await this.licenseRepository.find({
      relations: ['user'],
    });


    return licenses.map(license => this.mapLicenseToDto(license));
  }

  async findOneLicense(id: number): Promise<LicenseResponseDto> {
    const license = await this.licenseRepository.findOne({
      where: { id },
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

  async removeLicense(id: number): Promise<void> {
    await this.licenseRepository.delete(id);
  }

  async getAllLicensesForUser(userId: number): Promise<LicenseResponseDto[]> {
    // Verificar si el usuario existe
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    // Buscar todas las licencias asociadas al usuario
    const licenses = await this.licenseRepository.find({
      where: { user: { id: userId } }, // Buscar por ID del usuario
      order: { issuedDate: 'DESC' },
    });
    if (!licenses || licenses.length === 0) {
      throw new NotFoundException('No se encontraron licencias para este usuario');
    }

    // Mapear las licencias a DTOs
    return licenses.map(this.mapLicenseToDto);
  }

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
    };
  }


  async getTotalLicensesForUser(userId: number, startDate: Date, endDate: Date): Promise<{ totalLicenses: number; totalDays: number }> {
    const startDateTime = DateTime.fromJSDate(startDate).startOf('day');
    const endDateTime = DateTime.fromJSDate(endDate).startOf('day').plus({ days: 1 }); // Incluye el último día

    const licenses = await this.licenseRepository.createQueryBuilder('license')
      .where('license.user.id = :userId', { userId })
      .andWhere('license.startDate >= :startDate', { startDate: startDateTime.toISODate() })
      .andWhere('license.endDate <= :endDate', { endDate: endDateTime.toISODate() })
      .getMany();

    let totalDays = 0;
    for (const license of licenses) {
      const start = DateTime.fromJSDate(new Date(license.startDate)).startOf('day');
      const end = DateTime.fromJSDate(new Date(license.endDate)).startOf('day').plus({ days: 1 }); // Incluye el último día
      const days = end.diff(start, 'days').days;

      let additionalDays = 0;
      if (license.timeRequested === TimeRequest.HALF_DAY) {
        additionalDays = 0.5;
      } else if (license.timeRequested === TimeRequest.FULL_DAY) {
        additionalDays = days;
      } else if (license.timeRequested === TimeRequest.MULTIPLE_DAYS) {
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
    const supervisor = await this.userService.findById(supervisorId);

    if (!supervisor || !supervisor.department) {
      throw new Error('Supervisor or department not found');
    }

    // Obtener todas las licencias de los usuarios que pertenecen al departamento del supervisor
    const licenses = await this.licenseRepository.createQueryBuilder('license')
      .leftJoinAndSelect('license.user', 'user')
      .where('user.departmentId = :departmentId', { departmentId: supervisor.department.id })
      .getMany();

    // Mapear cada licencia al DTO con userId en lugar del objeto user
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
      userId: license.user.id,  // Extraer el userId del objeto user
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
      relations: ['user', 'user.department'],
    });

    if (!license) {
      throw new BadRequestException('License not found');
    }

    if (!license.user.department) {
      throw new BadRequestException('The user does not belong to any department.');
    }

    const supervisor = await this.userRepository.findOne({
      where: { id: supervisorId },
      relations: ['department'],
    });

    if (!supervisor) {
      throw new BadRequestException('Supervisor not found');
    }

    if (!supervisor.department) {
      throw new BadRequestException('The supervisor does not belong to any department.');
    }

    if (license.user.department.id !== supervisor.department.id) {
      throw new BadRequestException('Unauthorized: Supervisor does not belong to the same department as the user.');
    }

    // Actualizar el estado de aprobación de la licencia
    license.immediateSupervisorApproval = approval;
    license.approvedBySupervisor = approval ? supervisor : null;

    // Guardar los cambios en la licencia
    await this.licenseRepository.save(license);

    // Notificar al usuario sobre la aprobación o rechazo de la licencia
    const message = approval
      ? `Tu licencia fue aprobada por el supervisor ${supervisor.fullName}.`
      : `Tu licencia fue rechazada por el supervisor ${supervisor.fullName}.`;

    // Llamar al servicio de notificaciones para enviar la notificación
    await this.notificationService.notifyUser(license.user.id, message, supervisor.id);

    // Devolver la licencia con la estructura del DTO actualizado
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
      userDepartmentId: license.user.department.id,
      userDepartmentName: license.user.department.name,
      approvedBySupervisorId: approval ? supervisor.id : undefined,
      approvedBySupervisorName: approval ? supervisor.fullName : undefined,
      supervisorDepartmentId: approval ? supervisor.department.id : undefined,
      supervisorDepartmentName: approval ? supervisor.department.name : undefined,
    };
  }
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

    // Actualizar el estado de aprobación
    license.personalDepartmentApproval = approval;

    // Guardar y devolver la licencia actualizada
    const updatedLicense = await this.licenseRepository.save(license);

    // Notificar al usuario sobre la aprobación o rechazo de la licencia
    const message = approval
      ? `Tu licencia fue aprobada por el departamento de personal.`
      : `Tu licencia fue rechazada por el departamento de personal.`;

    // Llamar al servicio de notificaciones para enviar la notificación
    await this.notificationService.notifyUser(license.user.id, message, user.id);

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






  // Métodos auxiliares
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
    // Convertir las fechas de entrada a objetos Date sin hora (solo fecha)
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);

    // Asegurarse de que las fechas sean válidas
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Fechas inválidas');
    }

    // Formatear las fechas como strings YYYY-MM-DD para la comparación en la base de datos
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Consulta para verificar solapamiento
    const existingLicense = await this.licenseRepository.createQueryBuilder('license')
      .where('license.userId = :userId', { userId })
      .andWhere(`
      (license.startDate <= :endDate AND license.endDate >= :startDate) OR
      (license.startDate BETWEEN :startDate AND :endDate) OR
      (license.endDate BETWEEN :startDate AND :endDate)
    `, {
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


}