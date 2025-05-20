import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Profession } from 'src/entities/profession.entity';

@Injectable()
export class ProfessionService {
  constructor(
    @InjectRepository(Profession)
    private readonly professionRepository: Repository<Profession>,
  ) {}

  private validateNameOrThrow(name: any): string {
    if (typeof name !== 'string' || name.trim().length < 2) {
      throw new BadRequestException('El nombre es requerido y debe tener al menos 2 caracteres');
    }
    return name.trim().toUpperCase();
  }

  async create(data: any): Promise<Profession> {
    const name = this.validateNameOrThrow(data.name);

    const existing = await this.professionRepository.findOne({
      where: { name: ILike(name) },
    });

    if (existing) {
      throw new BadRequestException('Ya existe una profesión con ese nombre');
    }

    const profession = this.professionRepository.create({ name });
    return this.professionRepository.save(profession);
  }

  async update(id: number, data: any): Promise<Profession> {
    if (isNaN(id) || id <= 0) {
      throw new BadRequestException('ID inválido');
    }

    const profession = await this.professionRepository.findOne({ where: { id } });
    if (!profession) {
      throw new NotFoundException('Profesión no encontrada');
    }

    const name = this.validateNameOrThrow(data.name);

    const duplicate = await this.professionRepository.findOne({
      where: { name: ILike(name) },
    });

    if (duplicate && duplicate.id !== id) {
      throw new BadRequestException('Ya existe una profesión con ese nombre');
    }

    profession.name = name;
    return this.professionRepository.save(profession);
  }

  async findAll(): Promise<Profession[]> {
    return this.professionRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<Profession> {
    if (isNaN(id) || id <= 0) {
      throw new BadRequestException('ID inválido');
    }

    const profession = await this.professionRepository.findOne({ where: { id } });
    if (!profession) {
      throw new NotFoundException('Profesión no encontrada');
    }

    return profession;
  }

  async remove(id: number): Promise<void> {
    if (isNaN(id) || id <= 0) {
      throw new BadRequestException('ID inválido');
    }

    const result = await this.professionRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Profesión no encontrada');
    }
  }

  async searchByName(name: string): Promise<Profession[]> {
    if (!name || name.trim().length < 2) {
      throw new BadRequestException('El parámetro "name" es requerido y debe tener al menos 2 caracteres');
    }

    return this.professionRepository.find({
      where: { name: ILike(`%${name.trim()}%`) },
      order: { name: 'ASC' },
    });
  }
}
