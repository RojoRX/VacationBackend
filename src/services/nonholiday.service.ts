import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NonHoliday } from 'src/entities/nonholiday.entity';
import { DateTime } from 'luxon';

@Injectable()
export class NonHolidayService {
  constructor(
    @InjectRepository(NonHoliday)
    private readonly nonHolidayRepository: Repository<NonHoliday>
  ) {}

  async getNonHolidayDays(year: number): Promise<NonHoliday[]> {
    return this.nonHolidayRepository.find({ where: { year } });
  }

  async getActiveNonHolidayDays(year: number, currentDate: Date): Promise<number> {
    const nonHolidays = await this.getNonHolidayDays(year);
    let totalNonHolidayDays = 0;

    for (const nonHoliday of nonHolidays) {
      const nonHolidayDate = DateTime.fromISO(nonHoliday.date);
      
      // Solo contar días no hábiles que ocurren después de la fecha actual
      if (nonHolidayDate >= DateTime.fromJSDate(currentDate)) {
        totalNonHolidayDays += 1;
      }
    }

    return totalNonHolidayDays;
  }

  async addNonHoliday(nonHoliday: NonHoliday): Promise<NonHoliday> {
    // Verifica que no exista otro día no hábil en la misma fecha
    const existing = await this.getNonHolidayByDate(nonHoliday.year, nonHoliday.date);
    if (existing) {
      throw new BadRequestException(`El día ${nonHoliday.date} ya está registrado como no hábil.`);
    }
    return this.nonHolidayRepository.save(nonHoliday);
  }

  async updateNonHoliday(id: number, nonHoliday: Partial<NonHoliday>): Promise<NonHoliday> {
    await this.nonHolidayRepository.update(id, nonHoliday);
    return this.nonHolidayRepository.findOne({ where: { id } });
  }

  async deleteNonHoliday(id: number): Promise<void> {
    await this.nonHolidayRepository.delete(id);
  }

  async getNonHolidayByDate(year: number, date: string): Promise<NonHoliday | null> {
    return this.nonHolidayRepository.findOne({ where: { year, date } });
  }
}
