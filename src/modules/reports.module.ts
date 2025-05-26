// src/modules/reports/reports.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from 'src/controllers/reports.controller';
import { ReportsService } from 'src/services/reports.service';
import { License } from 'src/entities/license.entity';
import { User } from 'src/entities/user.entity';
import { VacationRequest } from 'src/entities/vacation_request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([License, User, VacationRequest])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
