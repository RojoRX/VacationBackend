// src/modules/employee-contract-history.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeContractHistory } from 'src/entities/employee-contract-history.entity';
import { User } from 'src/entities/user.entity';
import { EmployeeContractHistoryService } from 'src/services/employee-contract-history.service';
import { EmployeeContractHistoryController } from 'src/controllers/employee-contract-history.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeContractHistory, User])],
  providers: [EmployeeContractHistoryService],
  controllers: [EmployeeContractHistoryController],
  exports: [EmployeeContractHistoryService],
})
export class EmployeeContractHistoryModule {}
