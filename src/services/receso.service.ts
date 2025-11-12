import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';

@Injectable()
export class RecesoService {
  constructor(
    @InjectRepository(GeneralHolidayPeriod)
    private readonly holidayPeriodRepository: Repository<GeneralHolidayPeriod>
  ) { }

  async getHolidayPeriods(year: number) {
    const holidayPeriods = await this.holidayPeriodRepository.find({
      where: {
        year,
      },
    });

    return { holidayPeriods };
  }
async getHolidayPeriodsForPersonalYear(userStartDate: Date, userEndDate: Date) {
  const holidayPeriods = await this.holidayPeriodRepository.find({
    where: [
      { startDate: LessThanOrEqual(userEndDate), endDate: MoreThanOrEqual(userStartDate) }
    ],
    order: { startDate: 'ASC' },
  });

  // Ajustar fechas para que solo cuenten dentro del rango personal
  return holidayPeriods.map(receso => ({
    ...receso,
    startDate: receso.startDate < userStartDate ? userStartDate : receso.startDate,
    endDate: receso.endDate > userEndDate ? userEndDate : receso.endDate,
  }));
}


}
