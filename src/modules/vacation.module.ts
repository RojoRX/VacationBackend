import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';
import { VacationService } from '../services/vacation.service';
import { VacationController } from '../controllers/vacation.controller';
import { UserService } from '../services/user.service';
import { GeneralHolidayPeriodService } from 'src/services/generalHolidayPeriod.service';
import { UserModule } from './user.module';
import { NonHolidayModule } from './nonholiday.module'; // Importa NonHolidayModule para que NonHolidayService esté disponible
import { NonHolidayService } from 'src/services/nonholiday.service';
import { VacationCalculatorService } from 'src/services/vacation-calculator.service';
import { RecesoService } from 'src/services/receso.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GeneralHolidayPeriod]),
    UserModule,
    NonHolidayModule, // Asegúrate de que NonHolidayModule esté importado aquí
  ],
  controllers: [VacationController],
  providers: [VacationService, GeneralHolidayPeriod,VacationCalculatorService, RecesoService ],
})
export class VacationModule {}
