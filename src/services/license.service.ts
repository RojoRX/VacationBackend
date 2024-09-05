import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License, LicenseType, TimeRequest } from 'src/entities/license.entity';
import { DateTime } from 'luxon';
import { User } from 'src/entities/user.entity';
import { LicenseResponseDto } from 'src/dto/license-response.dto';

@Injectable()
export class LicenseService {
  constructor(
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  async createLicense(userId: number, licenseData: Partial<License>): Promise<LicenseResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validar enums
    if (!Object.values(LicenseType).includes(licenseData.licenseType)) {
      throw new BadRequestException(`Valor inválido para licenseType: ${licenseData.licenseType}`);
    }

    if (!Object.values(TimeRequest).includes(licenseData.timeRequested)) {
      throw new BadRequestException(`Valor inválido para timeRequested: ${licenseData.timeRequested}`);
    }

    const startDate = DateTime.fromISO(licenseData.startDate).startOf('day');
    const endDate = DateTime.fromISO(licenseData.endDate).startOf('day');
    const diffDays = endDate.diff(startDate, 'days').days;

    // Validar el rango de fechas
    if (startDate > endDate) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }

    // Calcular totalDays
    let totalDays = 0;
    if (licenseData.timeRequested === TimeRequest.HALF_DAY) {
      totalDays = 0.5;
    } else if (licenseData.timeRequested === TimeRequest.FULL_DAY || licenseData.timeRequested === TimeRequest.MULTIPLE_DAYS) {
      totalDays = diffDays + 1; // Incluye el último día
    }

    console.log(`Calculated totalDays: ${totalDays}`);

    // Validar el rango máximo permitido
    if (totalDays > 5) {
      throw new BadRequestException('La licencia no puede exceder los 5 días.');
    }

    // Manejar caso especial de medio día
    if (licenseData.timeRequested === TimeRequest.HALF_DAY && totalDays > 1) {
      throw new BadRequestException('Cuando se solicita medio día, el rango de fechas debe ser de un solo día.');
    }

    // Validar si ya existe una licencia en el mismo rango de fechas
    const existingLicense = await this.licenseRepository.createQueryBuilder('license')
      .where('license.user.id = :userId', { userId })
      .andWhere('license.startDate <= :endDate', { endDate: endDate.toISODate() })
      .andWhere('license.endDate >= :startDate', { startDate: startDate.toISODate() })
      .getOne();

    if (existingLicense) {
      throw new BadRequestException('Ya existe una licencia en el mismo rango de fechas.');
    }

    const license = this.licenseRepository.create({
      ...licenseData,
      user,
      totalDays,
    });

    console.log(`Saving License with totalDays: ${license.totalDays}`);

    const savedLicense = await this.licenseRepository.save(license);

    const savedLicenseFromDb = await this.licenseRepository.findOne({ where: { id: savedLicense.id } });
    console.log(`Saved License totalDays from DB: ${savedLicenseFromDb.totalDays}`);

    return this.mapLicenseToDto(savedLicense);
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
}
