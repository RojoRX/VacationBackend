import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License, LicenseType, TimeRequest } from 'src/entities/license.entity';
import { DateTime } from 'luxon';
import { User } from 'src/entities/user.entity';
import { LicenseResponseDto } from 'src/dto/license-response.dto';
import { UserService } from './user.service';
import { VacationService } from './vacation.service';

@Injectable()
export class LicenseService {
  constructor(
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    
    private userService: UserService,
    @Inject(forwardRef(() => VacationService))
    private readonly vacationService: VacationService,

  ) { }

  async createLicense(userId: number, licenseData: Partial<License>): Promise<LicenseResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
  
    const carnetIdentidad = user.ci;
  
    this.validateLicenseEnums(licenseData);
    const { startDate, endDate, totalDays } = this.calculateLicenseDays(licenseData);
  
    // Validar días de vacaciones disponibles
    const vacationInfo = await this.vacationService.calculateVacationPeriodByCI(carnetIdentidad);
    const remainingVacationDays = vacationInfo.diasDeVacacionRestantes;
  
    if (totalDays > remainingVacationDays) {
      throw new BadRequestException(`No tiene suficientes días de vacaciones disponibles. Solicitó ${totalDays} días, pero solo le quedan ${remainingVacationDays} días.`);
    }
  
    await this.validateNoExistingLicense(userId, startDate, endDate);
  
    const license = this.licenseRepository.create({
      ...licenseData,
      user,
      totalDays,
    });
  
    const savedLicense = await this.licenseRepository.save(license);
  
    return this.mapLicenseToDto(savedLicense);
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
  
  // Verificar si ya existe una licencia en el rango de fechas
  private async validateNoExistingLicense(userId: number, startDate: DateTime, endDate: DateTime) {
    const existingLicense = await this.licenseRepository.createQueryBuilder('license')
      .where('license.user.id = :userId', { userId })
      .andWhere('license.startDate <= :endDate', { endDate: endDate.toISODate() })
      .andWhere('license.endDate >= :startDate', { startDate: startDate.toISODate() })
      .getOne();
  
    if (existingLicense) {
      throw new BadRequestException('Ya existe una licencia en el mismo rango de fechas.');
    }
  }
  

  async findAllLicenses(): Promise<LicenseResponseDto[]> {
    const licenses = await this.licenseRepository.find({ relations: ['user'] });
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
        .leftJoinAndSelect('license.user', 'user') // Asegúrate de que la relación se cargue
        .where('license.user.id = :userId', { userId })
        .andWhere('license.startDate >= :startDate', { startDate: startDateTime.toISODate() })
        .andWhere('license.endDate < :endDate', { endDate: endDateTime.toISODate() })
        .andWhere('license.immediateSupervisorApproval = :approved', { approved: true })
        .andWhere('license.personalDepartmentApproval = :approved', { approved: true })
        .getMany();
  

  
      let totalAuthorizedDays = 0;
      const requests = licenses.map(license => {
        // Depuración de cada licencia

  
        if (!license.user) {
          console.error('License user is undefined for License ID:', license.id);
        }
  
        // Calcular los días totales según el tipo de solicitud
        let additionalDays = 0;
        if (license.timeRequested === TimeRequest.HALF_DAY) {
          additionalDays = 0.5;
        } else if (license.timeRequested === TimeRequest.FULL_DAY || license.timeRequested === TimeRequest.MULTIPLE_DAYS) {
          const start = DateTime.fromJSDate(new Date(license.startDate)).startOf('day');
          const end = DateTime.fromJSDate(new Date(license.endDate)).startOf('day').plus({ days: 1 }); // Incluye el último día
          const days = end.diff(start, 'days').days;
          additionalDays = days;
        }
  
        totalAuthorizedDays += additionalDays;
  
        // Mapear cada licencia a LicenseResponseDto para la respuesta
        return this.mapLicenseToDto(license);
      });
  
      return {
        totalAuthorizedDays,
        requests,
      };
  
    } catch (error) {
      console.error('Error al obtener licencias autorizadas:', error);
      throw new Error('Error al obtener licencias autorizadas');
    }
  }
  
  // Método para actualizar el estado de aprobación del supervisor inmediato
  async updateImmediateSupervisorApproval(licenseId: number, approval: boolean): Promise<License> {
    const license = await this.licenseRepository.findOne({ where: { id: licenseId } });

    if (!license) {
      throw new NotFoundException('Licencia no encontrada');
    }

    license.immediateSupervisorApproval = approval;
    return this.licenseRepository.save(license);
  }

  // Método para actualizar el estado de aprobación del departamento personal
  async updatePersonalDepartmentApproval(licenseId: number, approval: boolean): Promise<License> {
    const license = await this.licenseRepository.findOne({ where: { id: licenseId } });

    if (!license) {
      throw new NotFoundException('Licencia no encontrada');
    }

    license.personalDepartmentApproval = approval;
    return this.licenseRepository.save(license);
  }

// Método para obtener las licencias del departamento del supervisor
async findLicensesByDepartment(supervisorId: number): Promise<License[]> {
  const supervisor = await this.userService.findById(supervisorId);

  if (!supervisor || !supervisor.department) {
    throw new Error('Supervisor or department not found');
  }

  // Obtener todas las licencias de los usuarios que pertenecen al departamento del supervisor
  return this.licenseRepository.createQueryBuilder('license')
    .leftJoinAndSelect('license.user', 'user')
    .where('user.departmentId = :departmentId', { departmentId: supervisor.department.id })
    .getMany();
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
}