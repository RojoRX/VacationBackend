import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './modules/user.module';
import { ConfigModule } from '@nestjs/config';
import { HolidayPeriodModule } from './modules/holiday-period.module';
import { VacationModule } from './modules/vacation.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    UserModule, HolidayPeriodModule,VacationModule,
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
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule { }
