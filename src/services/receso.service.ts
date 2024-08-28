import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HolidayPeriod, HolidayPeriodType } from 'src/entities/holydayperiod.entity';
import { DateTime } from 'luxon';

@Injectable()
export class RecesoService {
  constructor(
    @InjectRepository(HolidayPeriod)
    private readonly holidayPeriodRepository: Repository<HolidayPeriod>,
  ) {}

  async getHolidayPeriods(year: number, department?: string) {
    const generalHolidayPeriods = await this.holidayPeriodRepository.find({
      where: {
        year,
        type: HolidayPeriodType.GENERAL,
      },
    });
  
    let specificHolidayPeriods = [];
    if (department) {
      specificHolidayPeriods = await this.holidayPeriodRepository.find({
        where: {
          year,
          type: HolidayPeriodType.SPECIFIC,
          career: department,
        },
      });
    }
  
    return { specificHolidayPeriods, generalHolidayPeriods };
  }
  
}
