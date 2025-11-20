// src/controllers/employee-contract-history.controller.ts
import { Controller, Post, Body, Get, Param, Put, Delete } from '@nestjs/common';
import { EmployeeContractHistoryService } from 'src/services/employee-contract-history.service';
import { CreateEmployeeContractHistoryDto } from 'src/dto/create-employee-contract-history.dto';
import { UpdateEmployeeContractHistoryDto } from 'src/dto/update-employee-contract-history.dto';

@Controller('employee-contract-history')
export class EmployeeContractHistoryController {
  constructor(
    private readonly service: EmployeeContractHistoryService
  ) {}

  @Post()
  create(@Body() dto: CreateEmployeeContractHistoryDto) {
    return this.service.create(dto);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: number) {
    return this.service.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateEmployeeContractHistoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: number) {
    return this.service.delete(id);
  }
}
