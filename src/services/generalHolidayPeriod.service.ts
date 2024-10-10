import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';
import { Repository, Not } from 'typeorm';
import { HolidayPeriodName } from 'src/entities/generalHolidayPeriod.entity';

@Injectable()
export class GeneralHolidayPeriodService {
  constructor(
    @InjectRepository(GeneralHolidayPeriod)
    private readonly generalHolidayPeriodRepository: Repository<GeneralHolidayPeriod>,
  ) {}

  // Crear un nuevo receso general
  async createGeneralHolidayPeriod(holidayPeriod: GeneralHolidayPeriod): Promise<GeneralHolidayPeriod> {
    // Verificar si ya existe un receso con el mismo nombre y año
    const existingGeneralPeriod = await this.generalHolidayPeriodRepository.findOne({
      where: { year: holidayPeriod.year, name: holidayPeriod.name },
    });

    if (existingGeneralPeriod) {
      throw new BadRequestException(`Ya existe un receso general de ${holidayPeriod.name} para el año ${holidayPeriod.year}.`);
    }

    return this.generalHolidayPeriodRepository.save(holidayPeriod);
  }

  // Obtener todos los recesos para un año específico
  async getGeneralHolidayPeriods(year: number): Promise<GeneralHolidayPeriod[]> {
    const periods = await this.generalHolidayPeriodRepository.find({ where: { year } });

    if (!periods.length) {
      throw new NotFoundException(`No se encontraron recesos generales para el año ${year}.`);
    }

    return periods;
  }

  // Obtener todos los recesos existentes (sin filtrar por año)
  async getAllGeneralHolidayPeriods(): Promise<GeneralHolidayPeriod[]> {
    return this.generalHolidayPeriodRepository.find();
  }

  // Actualizar un receso general existente
  async updateGeneralHolidayPeriod(id: number, holidayPeriod: GeneralHolidayPeriod): Promise<GeneralHolidayPeriod> {
    const existingPeriod = await this.generalHolidayPeriodRepository.findOne({ where: { id } });

    if (!existingPeriod) {
      throw new NotFoundException(`Receso con id ${id} no encontrado.`);
    }

    // Verificar si ya existe otro receso con el mismo nombre y año
    const conflictingPeriod = await this.generalHolidayPeriodRepository.findOne({
      where: { year: holidayPeriod.year, name: holidayPeriod.name, id: Not(id) },
    });

    if (conflictingPeriod) {
      throw new BadRequestException(`Ya existe un receso general de ${holidayPeriod.name} para el año ${holidayPeriod.year}.`);
    }

    await this.generalHolidayPeriodRepository.update(id, holidayPeriod);
    return this.generalHolidayPeriodRepository.findOne({ where: { id } });
  }

  // Eliminar un receso general
  async deleteGeneralHolidayPeriod(id: number): Promise<void> {
    const existingPeriod = await this.generalHolidayPeriodRepository.findOne({ where: { id } });

    if (!existingPeriod) {
      throw new NotFoundException(`Receso con id ${id} no encontrado.`);
    }

    await this.generalHolidayPeriodRepository.delete(id);
  }
}
