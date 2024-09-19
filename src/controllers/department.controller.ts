// src/controllers/department.controller.ts
import { Controller, Post, Put, Delete, Get, Param, Body } from '@nestjs/common';
import { DepartmentService } from 'src/services/department.service';
import { Department } from 'src/entities/department.entity';

@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  async createDepartment(@Body() body: { name: string; isCareer: boolean }): Promise<Department> {
    const { name, isCareer } = body;
    return this.departmentService.createDepartment(name, isCareer);
  }

  @Put(':id')
  async updateDepartment(
    @Param('id') id: number,
    @Body() body: { name: string; isCareer: boolean },
  ): Promise<Department> {
    const { name, isCareer } = body;
    return this.departmentService.updateDepartment(id, name, isCareer);
  }

  @Delete(':id')
  async deleteDepartment(@Param('id') id: number): Promise<void> {
    return this.departmentService.deleteDepartment(id);
  }

  @Get()
  async getDepartments(): Promise<Department[]> {
    return this.departmentService.getDepartments();
  }

  @Get(':id')
  async getDepartmentById(@Param('id') id: number): Promise<Department> {
    return this.departmentService.getDepartmentById(id);
  }
}
