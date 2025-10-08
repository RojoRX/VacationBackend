import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { License } from 'src/entities/license.entity';
import { LicenseService } from 'src/services/license.service';
import { LicenseController } from 'src/controllers/license.controller';
import { User } from 'src/entities/user.entity';
import { UserModule } from './user.module';
import { VacationModule } from './vacation.module'; // forwardRef para evitar la referencia circular
import { NotificationModule } from './notification.module';
import { NonHolidayModule } from './nonholiday.module';
import { NonHoliday } from 'src/entities/nonholiday.entity';
import { LicenseValidationService } from 'src/services/license-validation.service';
import { LicensesValidationController } from 'src/controllers/licenseValidation.controller';
import { LicenseUtilsService } from 'src/services/license-utils.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([License, User, NonHoliday]),
    UserModule,
    forwardRef(() => VacationModule), // Aquí se usa forwardRef
    NotificationModule,
    NonHolidayModule

  ],
  providers: [LicenseService, LicenseValidationService, LicenseUtilsService],
  controllers: [LicenseController, LicensesValidationController],
  exports: [LicenseService],
})
export class LicenseModule {}
