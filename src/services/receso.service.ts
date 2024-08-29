import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';

@Injectable()
export class RecesoService {
  constructor(
    @InjectRepository(GeneralHolidayPeriod)
    private readonly holidayPeriodRepository: Repository<GeneralHolidayPeriod>
  ) {}
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
  }
  
}
