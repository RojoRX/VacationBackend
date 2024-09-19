// src/services/department.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from 'src/entities/department.entity';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async createDepartment(name: string, isCareer: boolean): Promise<Department> {
    const department = this.departmentRepository.create({ name, isCareer });
    return this.departmentRepository.save(department);
  }

  async updateDepartment(id: number, name: string, isCareer: boolean): Promise<Department> {
    const department = await this.departmentRepository.findOne({where:{id}});
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    department.name = name;
    department.isCareer = isCareer;
    return this.departmentRepository.save(department);
  }

  async deleteDepartment(id: number): Promise<void> {
    const result = await this.departmentRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Department not found');
    }
  }

  async getDepartments(): Promise<Department[]> {
    return this.departmentRepository.find();
  }

  async getDepartmentById(id: number): Promise<Department> {
    const department = await this.departmentRepository.findOne({where:{id}});
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }
}
