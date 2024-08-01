import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';
import { VacationService } from 'src/services/vacation.service';
import { VacationController } from 'src/controllers/vacation.controller';
import { UserService } from 'src/services/user.service'; // Asegúrate de importar el UserService
import { HolidayPeriodService } from 'src/services/holydayperiod.service'; // Asegúrate de importar el HolidayPeriodService
import { UserModule } from './user.module';

@Module({
  imports: [TypeOrmModule.forFeature([HolidayPeriod]),UserModule ],
  controllers: [VacationController],
  providers: [VacationService, HolidayPeriodService],
})
export class VacationModule {}
