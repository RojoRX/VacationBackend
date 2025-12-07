// src/vacation-rules-config/vacation-rules-config.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VacationRulesConfig } from '../entities/vacation-rules-config.entity';

@Injectable()
export class VacationRulesConfigService {
  constructor(
    @InjectRepository(VacationRulesConfig)
    private readonly repo: Repository<VacationRulesConfig>,
  ) {}

  async getConfig(): Promise<VacationRulesConfig> {
    let config = await this.repo.findOne({ where: { id: 1 } });

    if (!config) {
      config = this.repo.create({});
      await this.repo.save(config);
    }

    return config;
  }

  async updateConfig(data: Partial<VacationRulesConfig>): Promise<VacationRulesConfig> {
    const config = await this.getConfig();
    Object.assign(config, data);
    return this.repo.save(config);
  }
}
