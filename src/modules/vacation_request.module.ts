// vacation_request.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VacationRequest } from 'src/entities/vacation_request.entity';
import { VacationRequestService } from 'src/services/vacation_request.service';
import { VacationRequestController } from 'src/controllers/vacation_request.controller';
import { UserService } from 'src/services/user.service';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { HttpModule } from '@nestjs/axios';
import { User } from 'src/entities/user.entity';
import { NonHoliday } from 'src/entities/nonholiday.entity';
import { Department } from 'src/entities/department.entity';
import { VacationService } from 'src/services/vacation.service';
import { VacationModule } from './vacation.module';
import { VacationCalculatorService } from 'src/services/vacation-calculator.service';
import { RecesoService } from 'src/services/receso.service';
import { UserHolidayPeriodService } from 'src/services/userholidayperiod.service';
import { LicenseService } from 'src/services/license.service';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';
import { UserHolidayPeriod } from 'src/entities/userholidayperiod.entity';
import { License } from 'src/entities/license.entity';
import { VacationPolicyModule } from './vacationPolicyModule.module';
import { Notification } from 'src/entities/notification.entity';
import { NotificationService } from 'src/services/notification.service';
import { ProfessionModule } from './profession.module';
import { Profession } from 'src/entities/profession.entity';
import { AcademicUnit } from 'src/entities/academic-unit.entity';
import { SystemConfigModule } from 'src/config/system-config.module';
import { UserConfigModule } from './user-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VacationRequest, User, NonHoliday, Department, GeneralHolidayPeriod, UserHolidayPeriod, License, Notification, Profession, AcademicUnit]),
    HttpModule,
    VacationPolicyModule,
    ProfessionModule,
    SystemConfigModule,
    UserConfigModule,
    forwardRef(() => VacationModule),
  ],
  controllers: [VacationRequestController],
  providers: [VacationRequestService, UserService, NonHolidayService, VacationService, VacationCalculatorService, RecesoService, UserHolidayPeriodService, LicenseService, NotificationService],
  exports: [VacationRequestService],
})
export class VacationRequestModule {}