import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministrativeHolidayPeriod } from 'src/entities/administrativeHolidayPeriod.entity';
import { AdministrativeHolidayPeriodService } from 'src/services/administrative-holiday-period.service';
import { AdministrativeHolidayPeriodController } from 'src/controllers/admin-holiday-period.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AdministrativeHolidayPeriod])],
  controllers: [AdministrativeHolidayPeriodController],
  providers: [AdministrativeHolidayPeriodService],
  exports: [AdministrativeHolidayPeriodService],
})
export class AdministrativeHolidayPeriodModule {}
