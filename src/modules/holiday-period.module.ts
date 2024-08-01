import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';
import { HolidayPeriodService } from 'src/services/holydayperiod.service';
import { HolidayPeriodController } from 'src/controllers/holydayperiod.controller';
import { HolidayPeriodRepository } from 'src/repositories/holiday-period.repository';

@Module({
  imports: [TypeOrmModule.forFeature([HolidayPeriod, HolidayPeriodRepository])],
  controllers: [HolidayPeriodController],
  providers: [HolidayPeriodService],
})
export class HolidayPeriodModule {}
