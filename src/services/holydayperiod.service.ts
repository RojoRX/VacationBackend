import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';
import { DateTime } from 'luxon';

@Injectable()
export class HolidayPeriodService {
  constructor(
    @InjectRepository(HolidayPeriod)
    private readonly holidayPeriodRepository: Repository<HolidayPeriod>,
  ) {}

  async findAll(): Promise<HolidayPeriod[]> {
    return this.holidayPeriodRepository.find();
  }

  async createHolidayPeriod(holidayPeriod: Partial<HolidayPeriod>): Promise<HolidayPeriod> {
    const existingPeriod = await this.holidayPeriodRepository.findOne({
      where: { year: holidayPeriod.year, name: holidayPeriod.name },
    });

    if (existingPeriod) {
      throw new BadRequestException(`Ya existe un receso de tipo ${holidayPeriod.name} para el año ${holidayPeriod.year}`);
    }

    holidayPeriod.startDate = DateTime.fromISO(holidayPeriod.startDate as any).toUTC().toJSDate();
    holidayPeriod.endDate = DateTime.fromISO(holidayPeriod.endDate as any).toUTC().toJSDate();
    
    return this.holidayPeriodRepository.save(holidayPeriod);
  }

  async getHolidayPeriods(year: number): Promise<HolidayPeriod[]> {  // Aquí está el nombre correcto del método
    return this.holidayPeriodRepository.find({ where: { year } });
  }

  async updateHolidayPeriod(id: number, holidayPeriod: Partial<HolidayPeriod>): Promise<HolidayPeriod> {
    const existingPeriod = await this.holidayPeriodRepository.findOne({where:{id: id}});

    if (!existingPeriod) {
      throw new BadRequestException(`No se encontró un receso con el ID ${id}`);
    }

    if (holidayPeriod.name && holidayPeriod.name !== existingPeriod.name) {
      const conflictPeriod = await this.holidayPeriodRepository.findOne({
        where: { year: holidayPeriod.year || existingPeriod.year, name: holidayPeriod.name },
      });

      if (conflictPeriod) {
        throw new BadRequestException(`Ya existe un receso de tipo ${holidayPeriod.name} para el año ${holidayPeriod.year || existingPeriod.year}`);
      }
    }

    if (holidayPeriod.startDate) {
      holidayPeriod.startDate = DateTime.fromISO(holidayPeriod.startDate as any).toUTC().toJSDate();
    }
    if (holidayPeriod.endDate) {
      holidayPeriod.endDate = DateTime.fromISO(holidayPeriod.endDate as any).toUTC().toJSDate();
    }
    
    await this.holidayPeriodRepository.update(id, holidayPeriod);
    return this.holidayPeriodRepository.findOne({where:{id: id}});
  }

  async deleteHolidayPeriod(id: number): Promise<void> {
    await this.holidayPeriodRepository.delete(id);
  }
}
