import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NonHoliday } from 'src/entities/nonholiday.entity';

@Injectable()
export class NonHolidayService {
  constructor(
    @InjectRepository(NonHoliday)
    private readonly nonHolidayRepository: Repository<NonHoliday>
  ) {}

  async getNonHolidayDays(year: number): Promise<number> {
    const nonHoliday = await this.nonHolidayRepository.findOne({ where: { year } });
    return nonHoliday ? nonHoliday.days : 0;
  }

  async addNonHoliday(nonHoliday: NonHoliday): Promise<NonHoliday> {
    return this.nonHolidayRepository.save(nonHoliday);
  }

  async updateNonHoliday(id: number, nonHoliday: Partial<NonHoliday>): Promise<NonHoliday> {
    await this.nonHolidayRepository.update(id, nonHoliday);
    return this.nonHolidayRepository.findOne({ where: { id } });
  }

  async deleteNonHoliday(id: number): Promise<void> {
    await this.nonHolidayRepository.delete(id);
  }
}
