import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
<<<<<<< HEAD
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';
=======
import { Repository } from 'typeorm';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';
>>>>>>> Adding_Entities

@Injectable()
export class RecesoService {
  constructor(
    @InjectRepository(GeneralHolidayPeriod)
    private readonly holidayPeriodRepository: Repository<GeneralHolidayPeriod>
  ) {}
<<<<<<< HEAD
  async getHolidayPeriods(startDate: Date, endDate: Date): Promise<{ generalHolidayPeriods: GeneralHolidayPeriod[] }> {
    console.log(`Buscando recesos generales entre ${startDate.toISOString()} y ${endDate.toISOString()}`);
  
    const generalHolidayPeriods = await this.holidayPeriodRepository.find({
      where: [
        { 
          startDate: LessThanOrEqual(endDate),
          endDate: MoreThanOrEqual(startDate),
        }
      ]
    });
  
    console.log(`Recesos generales obtenidos: ${JSON.stringify(generalHolidayPeriods)}`);
    
    return { generalHolidayPeriods };
=======

  async getHolidayPeriods(year: number) {
    const holidayPeriods = await this.holidayPeriodRepository.find({
      where: {
        year,
      },
    });

    return { holidayPeriods };
>>>>>>> Adding_Entities
  }
}
