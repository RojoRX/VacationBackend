// src/modules/userholidayperiod.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// ✅ CORREGIR (nombre exacto)
import { UserHolidayPeriod } from '../entities/userHolidayPeriod.entity';
import { User } from 'src/entities/user.entity'; // Importa la entidad User
import { UserHolidayPeriodService } from 'src/services/userholidayperiod.service';
import { UserHolidayPeriodController } from 'src/controllers/userholidayperiod.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserHolidayPeriod, User]), // Incluye ambas entidades
  ],
  providers: [UserHolidayPeriodService],
  controllers: [UserHolidayPeriodController],
  exports: [UserHolidayPeriodService], // Asegúrate de exportar el servicio si es necesario en otros módulos
})
export class UserHolidayPeriodModule {}
