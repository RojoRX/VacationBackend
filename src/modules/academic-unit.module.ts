// src/academic-unit/academic-unit.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicUnit } from 'src/entities/academic-unit.entity';
import { AcademicUnitService } from 'src/services/academic-unit.service';
import { AcademicUnitController } from 'src/controllers/academic-unit.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicUnit])],
  controllers: [AcademicUnitController],
  providers: [AcademicUnitService],
  exports: [AcademicUnitService],
})
export class AcademicUnitModule {}
