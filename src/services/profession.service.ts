import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profession } from 'src/entities/profession.entity';
import { CreateProfessionDto } from 'src/dto/create-profession.dto';

@Injectable()
export class ProfessionService {
  constructor(
    @InjectRepository(Profession)
    private professionRepository: Repository<Profession>,
  ) {}

  async create(dto: CreateProfessionDto): Promise<Profession> {
    const profession = this.professionRepository.create(dto);
    return this.professionRepository.save(profession);
  }

  async findAll(): Promise<Profession[]> {
    return this.professionRepository.find();
  }

  async findOne(id: number): Promise<Profession> {
    const profession = await this.professionRepository.findOne({ where: { id } });
    if (!profession) throw new NotFoundException('Profession not found');
    return profession;
  }

  async remove(id: number): Promise<void> {
    const result = await this.professionRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Profession not found');
    }
  }
}
