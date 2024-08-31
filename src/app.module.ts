import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './modules/user.module';
import { ConfigModule } from '@nestjs/config';
import { HolidayPeriodModule } from './modules/holiday-period.module';
import { VacationModule } from './modules/vacation.module';
import { NonHolidayModule } from './modules/nonholiday.module';
import { GestionPeriodModule } from './modules/gestion.module';
import { LicenseModule } from './modules/license.module';
import { UserHolidayPeriodModule } from './modules/userholidayperiod.module';

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
    HolidayPeriodModule,
    VacationModule,
    NonHolidayModule,
    GestionPeriodModule, 
    LicenseModule, 
    UserHolidayPeriodModule
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule { }
