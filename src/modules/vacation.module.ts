import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HolidayPeriod } from '../entities/holydayperiod.entity';
import { VacationService } from '../services/vacation.service';
import { VacationController } from '../controllers/vacation.controller';
import { UserService } from '../services/user.service';
import { HolidayPeriodService } from '../services/holydayperiod.service';
import { UserModule } from './user.module';
import { NonHolidayModule } from './nonholiday.module'; // Importa NonHolidayModule para que NonHolidayService esté disponible
import { NonHolidayService } from 'src/services/nonholiday.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HolidayPeriod]),
    UserModule,
    NonHolidayModule, // Asegúrate de que NonHolidayModule esté importado aquí
  ],
  controllers: [VacationController],
  providers: [VacationService, HolidayPeriodService, ],
})
export class VacationModule {}
