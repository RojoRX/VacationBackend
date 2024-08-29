import { EntityRepository, Repository } from 'typeorm';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';

@EntityRepository(GeneralHolidayPeriod)
export class HolidayPeriodRepository extends Repository<GeneralHolidayPeriod> {}
