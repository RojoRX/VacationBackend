// src/modules/department.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from 'src/entities/department.entity';
import { DepartmentService } from 'src/services/department.service';
import { DepartmentController } from 'src/controllers/department.controller';
import { UserModule } from './user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Department]),
  UserModule],
  providers: [DepartmentService],
  controllers: [DepartmentController],
  exports: [DepartmentService],
})
export class DepartmentModule {}
