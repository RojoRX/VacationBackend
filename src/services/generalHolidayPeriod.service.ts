import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';
import { Not, Repository } from 'typeorm';

@Injectable()
export class GeneralHolidayPeriodService {
  constructor(
    @InjectRepository(GeneralHolidayPeriod)
    private generalHolidayPeriodRepository: Repository<GeneralHolidayPeriod>,
  ) {}

  async createGeneralHolidayPeriod(holidayPeriod: GeneralHolidayPeriod): Promise<GeneralHolidayPeriod> {
    // Verifica si ya existe un receso general con el mismo nombre y año
    const existingGeneralPeriod = await this.generalHolidayPeriodRepository.findOne({
      where: { year: holidayPeriod.year, name: holidayPeriod.name }
    });

    if (existingGeneralPeriod) {
      throw new BadRequestException(`Ya existe un receso general de ${holidayPeriod.name} para este año.`);
    }

    return this.generalHolidayPeriodRepository.save(holidayPeriod);
  }

  async getGeneralHolidayPeriods(year: number): Promise<GeneralHolidayPeriod[]> {
    return this.generalHolidayPeriodRepository.find({ where: { year } });
  }

  async updateGeneralHolidayPeriod(id: number, holidayPeriod: GeneralHolidayPeriod): Promise<GeneralHolidayPeriod> {
    const existingPeriod = await this.generalHolidayPeriodRepository.findOne({ where: { id } });

    if (!existingPeriod) {
      throw new NotFoundException(`Receso con id ${id} no encontrado.`);
    }

    // Verifica si ya existe otro receso general con el mismo nombre y año, excluyendo el actual por su id
    const existingGeneralPeriod = await this.generalHolidayPeriodRepository.findOne({
      where: { year: holidayPeriod.year, name: holidayPeriod.name, id: Not(id) }
    });

    if (existingGeneralPeriod) {
      throw new BadRequestException(`Ya existe un receso general de ${holidayPeriod.name} para este año.`);
    }

    await this.generalHolidayPeriodRepository.update(id, holidayPeriod);
    return this.generalHolidayPeriodRepository.findOne({ where: { id } });
  }
}
