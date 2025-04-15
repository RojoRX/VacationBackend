import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './modules/user.module';
import { ConfigModule } from '@nestjs/config';
import { GeneralHolidayPeriodModule } from './modules/generalholidayperiod.module';
import { VacationModule } from './modules/vacation.module';
import { NonHolidayModule } from './modules/nonholiday.module';
import { GestionPeriodModule } from './modules/gestion.module';
import { LicenseModule } from './modules/license.module';
import { UserHolidayPeriodModule } from './modules/userholidayperiod.module';
import { VacationRequestModule } from './modules/vacation_request.module';
import { DepartmentModule } from './modules/department.module';
import { VacationPolicyModule } from './modules/vacationPolicyModule.module';
import { NotificationModule } from './modules/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT, 10),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize:
        true,
    }),
    UserModule,
    GeneralHolidayPeriodModule,
    VacationModule,
    NonHolidayModule,
    GestionPeriodModule, 
    LicenseModule, 
    UserHolidayPeriodModule,
    VacationRequestModule,
    DepartmentModule, 
    VacationPolicyModule,
    NotificationModule
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule { }
