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
import { UserHolidayPeriodService } from 'src/services/userholidayperiod.service';
import { UserHolidayPeriodModule } from './userholidayperiod.module';
import { UserHolidayPeriod } from 'src/entities/userholidayperiod.entity';
import { LicenseService } from 'src/services/license.service';
import { License } from 'src/entities/license.entity';
import { LicenseModule } from './license.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GeneralHolidayPeriod, UserHolidayPeriod, License]),
    UserModule,
    NonHolidayModule, // Asegúrate de que NonHolidayModule esté importado aquí
    UserHolidayPeriodModule,
    LicenseModule
  ],
  controllers: [VacationController],
  providers: [VacationService, GeneralHolidayPeriod,VacationCalculatorService, RecesoService,],
})
export class VacationModule {}
