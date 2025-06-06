// src/modules/user.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from 'src/controllers/user.controller';
import { UserService } from 'src/services/user.service';
import { User } from 'src/entities/user.entity';
import { UserHolidayPeriod } from 'src/entities/userholidayperiod.entity'; // Importa la entidad relacionada
import { HolidayPeriod } from 'src/entities/holydayperiod.entity'; // Importa la entidad HolidayPeriod si es usada en la relación
import { MockUserService } from 'src/mocks/user.service.mock';
import { Department } from 'src/entities/department.entity';
import { Profession } from 'src/entities/profession.entity';
import { AcademicUnit } from 'src/entities/academic-unit.entity';
@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([User, UserHolidayPeriod, HolidayPeriod, Department, Profession, AcademicUnit]), // Asegúrate de incluir todas las entidades relacionadas
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule { }