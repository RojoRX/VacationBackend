import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';
import { GeneralHolidayPeriodService } from 'src/services/generalHolidayPeriod.service';
import { GeneralHolidayPeriodController } from 'src/controllers/generalholidayperiod.controller';
import { HolidayPeriodRepository } from 'src/repositories/holiday-period.repository';

@Module({
  imports: [TypeOrmModule.forFeature([GeneralHolidayPeriod, HolidayPeriodRepository])],
  controllers: [GeneralHolidayPeriodController],
  providers: [GeneralHolidayPeriodService],
})
export class GeneralHolidayPeriodModule {}
