// src/academic-unit/academic-unit.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { AcademicUnit } from 'src/entities/academic-unit.entity';

@Injectable()
export class AcademicUnitService {
  constructor(
    @InjectRepository(AcademicUnit)
    private academicUnitRepository: Repository<AcademicUnit>,
  ) { }

  async findAll(): Promise<AcademicUnit[]> {
    return this.academicUnitRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<AcademicUnit> {
    const unit = await this.academicUnitRepository.findOneBy({ id });
    if (!unit) {
      throw new NotFoundException(`Unidad académica con ID ${id} no encontrada`);
    }
    return unit;
  }

  async create(data: Partial<AcademicUnit>): Promise<AcademicUnit> {
    const name = this.normalizeName(data.name);
    this.validateName(name);

    const existing = await this.academicUnitRepository.findOne({
      where: { name: ILike(name) },
    });

    if (existing) {
      throw new BadRequestException(`Ya existe una unidad académica con ese nombre`);
    }

    const newUnit = this.academicUnitRepository.create({ ...data, name });
    return this.academicUnitRepository.save(newUnit);
  }

  async update(id: number, data: Partial<AcademicUnit>): Promise<AcademicUnit> {
    const unit = await this.findOne(id);

    if (data.name) {
      const name = this.normalizeName(data.name);
      this.validateName(name);

      const duplicate = await this.academicUnitRepository.findOne({
        where: { name: ILike(name) },
      });

      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException(`Otra unidad académica ya tiene ese nombre`);
      }

      unit.name = name;
    }

    return this.academicUnitRepository.save(unit);
  }
  async searchByName(name: string): Promise<AcademicUnit[]> {
    const normalized = this.normalizeName(name);
    return this.academicUnitRepository.find({
      where: { name: ILike(`%${normalized}%`) },
      order: { name: 'ASC' },
    });
  }


  async remove(id: number): Promise<void> {
    const unit = await this.findOne(id);
    await this.academicUnitRepository.remove(unit);
  }

  private normalizeName(name: string): string {
    return name?.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  private validateName(name: string): void {
    if (!name || name.length < 4) {
      throw new BadRequestException('El nombre debe tener al menos 4 caracteres');
    }
  }
}
