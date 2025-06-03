import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserConfig } from 'src/entities/user-config.entity';
import { CreateUserConfigDto } from 'src/dto/create-user-config.dto';
import { UpdateUserConfigDto } from 'src/dto/update-user-config.dto';
import { User } from 'src/entities/user.entity';

@Injectable()
export class UserConfigService {
  constructor(
    @InjectRepository(UserConfig)
    private readonly configRepo: Repository<UserConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) { }

  async create(dto: CreateUserConfigDto): Promise<UserConfig> {
    const { customStartYear, initialVacationBalance } = dto;

    // Validar que al menos uno de los campos tenga un valor definido
    if (
      customStartYear === undefined &&
      initialVacationBalance === undefined
    ) {
      throw new BadRequestException(
        'Debe proporcionar al menos un valor: año de inicio o saldo inicial de vacaciones.'
      );
    }

    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const existing = await this.configRepo.findOne({
      where: { user: { id: dto.userId } },
    });

    if (existing) {
      throw new ConflictException('Ya existe una configuración para este usuario');
    }

    const config = this.configRepo.create({
      ...dto,
      user,
    });

    return this.configRepo.save(config);
  }
  async findByUserId(userId: number): Promise<UserConfig> {
    const config = await this.configRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!config) {
      throw new NotFoundException(`No se encontró configuración para el usuario ${userId}`);
    }

    return config;
  }
  async update(userId: number, dto: UpdateUserConfigDto): Promise<UserConfig> {
    const config = await this.findByUserId(userId);
    if (!config) {
      throw new NotFoundException('Configuración no encontrada');
    }

    Object.assign(config, dto);
    return this.configRepo.save(config);
  }

  async delete(userId: number): Promise<void> {
    const config = await this.findByUserId(userId);
    if (config) {
      await this.configRepo.remove(config);
    }
  }
}
