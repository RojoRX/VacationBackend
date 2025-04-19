// src/services/department.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Department } from 'src/entities/department.entity';
import { startCase, toLower } from 'lodash';
import * as removeAccents from 'remove-accents';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  private normalizeName(name: string): string {
    const cleaned = name.replace(/\s+/g, ' ').trim(); // elimina espacios extra
    return startCase(toLower(cleaned)); // convierte a formato tipo "Carrera De Física"
  }

  private validateDepartmentName(name: string) {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('El nombre del departamento es requerido.');
    }

    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 100) {
      throw new BadRequestException(
        'El nombre debe tener entre 3 y 100 caracteres.',
      );
    }

    const isValidName = /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s\-]+$/.test(trimmed);
    if (!isValidName) {
      throw new BadRequestException(
        'El nombre contiene caracteres no válidos. Solo se permiten letras, espacios y guiones.',
      );
    }

    const forbiddenNames = ['departamento', 'carrera', 'administración'];
    if (forbiddenNames.includes(trimmed.toLowerCase())) {
      throw new BadRequestException(
        'El nombre es demasiado genérico. Por favor, sé más específico.',
      );
    }
  }

  private async isDuplicateName(normalizedName: string, excludeId?: number) {
    const departments = await this.departmentRepository.find();
    const normalizedInput = removeAccents(normalizedName.toLowerCase());

    return departments.some((dept) => {
      const currentNormalized = removeAccents(
        dept.name.toLowerCase().replace(/\s+/g, ' ').trim(),
      );
      return (
        currentNormalized === normalizedInput &&
        (excludeId ? dept.id !== excludeId : true)
      );
    });
  }

  async createDepartment(
    name: string,
    isCareer: boolean,
  ): Promise<Department> {
    this.validateDepartmentName(name);

    const normalized = this.normalizeName(name);

    if (await this.isDuplicateName(normalized)) {
      throw new BadRequestException(
        'Ya existe un departamento con un nombre similar.',
      );
    }

    const department = this.departmentRepository.create({
      name: normalized,
      isCareer,
    });

    return this.departmentRepository.save(department);
  }

  async updateDepartment(
    id: number,
    name: string,
    isCareer: boolean,
  ): Promise<Department> {
    const department = await this.departmentRepository.findOne({ where: { id } });

    if (!department) {
      throw new NotFoundException('Departamento no encontrado.');
    }

    this.validateDepartmentName(name);
    const normalized = this.normalizeName(name);

    if (await this.isDuplicateName(normalized, id)) {
      throw new BadRequestException(
        'Ya existe otro departamento con un nombre similar.',
      );
    }

    department.name = normalized;
    department.isCareer = isCareer;

    return this.departmentRepository.save(department);
  }

  async deleteDepartment(id: number): Promise<void> {
    const result = await this.departmentRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException('Departamento no encontrado.');
    }
  }

  async getDepartments(): Promise<Department[]> {
    return this.departmentRepository.find();
  }

  async getDepartmentById(id: number): Promise<Department> {
    const department = await this.departmentRepository.findOne({ where: { id } });

    if (!department) {
      throw new NotFoundException('Departamento no encontrado.');
    }

    return department;
  }
}
