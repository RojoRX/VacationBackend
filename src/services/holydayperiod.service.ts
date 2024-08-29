import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { HolidayPeriod, HolidayPeriodName } from 'src/entities/holydayperiod.entity';

@Injectable()
export class HolidayPeriodService {
  constructor(
    @InjectRepository(HolidayPeriod)
    private holidayPeriodRepository: Repository<HolidayPeriod>,
  ) {}

  async createHolidayPeriod(holidayPeriod: HolidayPeriod): Promise<HolidayPeriod> {
    // Verificar existencia de un receso general con el mismo nombre y año
    const existingPeriod = await this.holidayPeriodRepository.findOne({
      where: { year: holidayPeriod.year, name: holidayPeriod.name }
    });
    if (existingPeriod) {
      throw new BadRequestException(`Ya existe un receso de ${holidayPeriod.name} para este año.`);
    }

    return this.holidayPeriodRepository.save(holidayPeriod);
  }

  async getHolidayPeriods(year: number): Promise<HolidayPeriod[]> {
    return this.holidayPeriodRepository.find({ where: { year } });
  }

  async updateHolidayPeriod(id: number, holidayPeriod: HolidayPeriod): Promise<HolidayPeriod> {
    const existingPeriod = await this.holidayPeriodRepository.findOne({ where: { id } });
    if (!existingPeriod) {
      throw new NotFoundException(`Receso con id ${id} no encontrado.`);
    }

    // Verificar existencia de un receso general con el mismo nombre y año, excluyendo el actual
    const existingConflictingPeriod = await this.holidayPeriodRepository.findOne({
      where: { year: holidayPeriod.year, name: holidayPeriod.name, id: Not(id) }
    });
    if (existingConflictingPeriod) {
      throw new BadRequestException(`Ya existe un receso de ${holidayPeriod.name} para este año.`);
    }

    await this.holidayPeriodRepository.update(id, holidayPeriod);
    return this.holidayPeriodRepository.findOne({ where: { id } });
  }
}
