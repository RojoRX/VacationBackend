import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License, TimeRequest } from 'src/entities/license.entity';
import { DateTime } from 'luxon';

@Injectable()
export class LicenseService {
  constructor(
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
  ) {}

  async createLicense(licenseData: Partial<License>): Promise<License> {
    const license = this.licenseRepository.create(licenseData);
    return await this.licenseRepository.save(license);
  }

  async findAllLicenses(): Promise<License[]> {
    return await this.licenseRepository.find();
  }

  async findOneLicense(id: number): Promise<License> {
    return await this.licenseRepository.findOneBy({ id });
  }

  async updateLicense(id: number, updateData: Partial<License>): Promise<License> {
    await this.licenseRepository.update(id, updateData);
    return this.findOneLicense(id);
  }

  async removeLicense(id: number): Promise<void> {
    await this.licenseRepository.delete(id);
  }

  async getTotalLicensesForUser(carnetIdentidad: string, startDate: Date, endDate: Date): Promise<{ totalLicenses: number; totalDays: number }> {
    // Convertir fechas a DateTime
    const startDateTime = DateTime.fromJSDate(startDate).startOf('day');
    const endDateTime = DateTime.fromJSDate(endDate).endOf('day');

    // Buscar licencias del usuario en el rango de fechas
    const licenses = await this.licenseRepository.createQueryBuilder('license')
      .where('license.applicantCI = :carnetIdentidad', { carnetIdentidad })
      .andWhere('license.startDate >= :startDate', { startDate: startDateTime.toISODate() })
      .andWhere('license.endDate <= :endDate', { endDate: endDateTime.toISODate() })
      .getMany();

    // Calcular el total de días
    let totalDays = 0;
    for (const license of licenses) {
      const start = DateTime.fromJSDate(new Date(license.startDate));
      const end = DateTime.fromJSDate(new Date(license.endDate));
      const days = end.diff(start, 'days').days + 1; // Incluye el día de inicio
      let additionalDays = 0;

      switch (license.timeRequested) {
        case TimeRequest.HALF_MORNING:
        case TimeRequest.AFTERNOON:
          additionalDays = 0.5;
          break;
        case TimeRequest.FULL_DAY:
          additionalDays = 1;
          break;
        case TimeRequest.TWO_DAYS:
          additionalDays = 2;
          break;
        case TimeRequest.THREE_DAYS:
          additionalDays = 3;
          break;
        case TimeRequest.FOUR_DAYS:
          additionalDays = 4;
          break;
        case TimeRequest.FIVE_DAYS:
          additionalDays = 5;
          break;
      }
      
      totalDays += days - 1 + additionalDays; // -1 porque `days` incluye el día final
    }

    return {
      totalLicenses: licenses.length,
      totalDays,
    };
  }
}
