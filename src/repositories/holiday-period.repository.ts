import { EntityRepository, Repository } from 'typeorm';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';

@EntityRepository(HolidayPeriod)
export class HolidayPeriodRepository extends Repository<HolidayPeriod> {}
