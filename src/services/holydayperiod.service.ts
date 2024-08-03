import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { HolidayPeriod, HolidayPeriodName, HolidayPeriodType } from 'src/entities/holydayperiod.entity';


@Injectable()
export class HolidayPeriodService {
  constructor(
    @InjectRepository(HolidayPeriod)
    private holidayPeriodRepository: Repository<HolidayPeriod>,
  ) {}

  async createHolidayPeriod(holidayPeriod: HolidayPeriod): Promise<HolidayPeriod> {
    if (holidayPeriod.type === HolidayPeriodType.GENERAL) {
      const existingGeneralPeriod = await this.holidayPeriodRepository.findOne({
        where: { year: holidayPeriod.year, type: HolidayPeriodType.GENERAL, name: holidayPeriod.name }
      });
      if (existingGeneralPeriod) {
        throw new BadRequestException(`Ya existe un receso general de ${holidayPeriod.name} para este año.`);
      }
    }

    if (holidayPeriod.type === HolidayPeriodType.SPECIFIC && holidayPeriod.career) {
      const existingSpecificPeriod = await this.holidayPeriodRepository.findOne({
        where: { year: holidayPeriod.year, type: HolidayPeriodType.SPECIFIC, name: holidayPeriod.name, career: holidayPeriod.career }
      });
      if (existingSpecificPeriod) {
        throw new BadRequestException(`Ya existe un receso específico de ${holidayPeriod.name} para la carrera ${holidayPeriod.career} en este año.`);
      }
    }

    return this.holidayPeriodRepository.save(holidayPeriod);
  }

  async getHolidayPeriods(year: number): Promise<HolidayPeriod[]> {
    return this.holidayPeriodRepository.find({ where: { year } });
  }

  async getGeneralHolidayPeriods(year: number): Promise<HolidayPeriod[]> {
    return this.holidayPeriodRepository.find({ where: { year, type: HolidayPeriodType.GENERAL } });
  }

  async getSpecificHolidayPeriods(year: number, career: string): Promise<HolidayPeriod[]> {
    return this.holidayPeriodRepository.find({ where: { year, type: HolidayPeriodType.SPECIFIC, career } });
  }

  async updateHolidayPeriod(id: number, holidayPeriod: HolidayPeriod): Promise<HolidayPeriod> {
    const existingPeriod = await this.holidayPeriodRepository.findOne({where:{id:id}});
    if (!existingPeriod) {
      throw new NotFoundException(`Receso con id ${id} no encontrado.`);
    }

    if (holidayPeriod.type === HolidayPeriodType.GENERAL) {
      const existingGeneralPeriod = await this.holidayPeriodRepository.findOne({
        where: { year: holidayPeriod.year, type: HolidayPeriodType.GENERAL, name: holidayPeriod.name, id: Not(id) }
      });
      if (existingGeneralPeriod) {
        throw new BadRequestException(`Ya existe un receso general de ${holidayPeriod.name} para este año.`);
      }
    }

    if (holidayPeriod.type === HolidayPeriodType.SPECIFIC && holidayPeriod.career) {
      const existingSpecificPeriod = await this.holidayPeriodRepository.findOne({
        where: { year: holidayPeriod.year, type: HolidayPeriodType.SPECIFIC, name: holidayPeriod.name, career: holidayPeriod.career, id: Not(id) }
      });
      if (existingSpecificPeriod) {
        throw new BadRequestException(`Ya existe un receso específico de ${holidayPeriod.name} para la carrera ${holidayPeriod.career} en este año.`);
      }
    }

    await this.holidayPeriodRepository.update(id, holidayPeriod);
    return this.holidayPeriodRepository.findOne({where:{id:id}});
  }
}