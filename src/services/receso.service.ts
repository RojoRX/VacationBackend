import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';

@Injectable()
export class RecesoService {
  constructor(
    @InjectRepository(HolidayPeriod)
    private readonly holidayPeriodRepository: Repository<HolidayPeriod>,
  ) {}

  async getHolidayPeriods(year: number) {
    const holidayPeriods = await this.holidayPeriodRepository.find({
      where: {
        year,
      },
    });

    return { holidayPeriods };
  }
}
