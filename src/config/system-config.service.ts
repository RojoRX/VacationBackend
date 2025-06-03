// system-config.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from './system-config.entity';

@Injectable()
export class SystemConfigService {
    constructor(
        @InjectRepository(SystemConfig)
        private readonly configRepo: Repository<SystemConfig>,
    ) { }

    async get(key: string): Promise<string | null> {
        const config = await this.configRepo.findOne({ where: { key } });
        return config?.value ?? null;
    }

    async getDate(key: string): Promise<Date | null> {
        const rawValue = await this.get(key);
        return rawValue ? new Date(rawValue) : null;
    }
    // En system-config.service.ts
    async set(key: string, value: string): Promise<string> {
        let config = await this.configRepo.findOne({ where: { key } });

        if (!config) {
            config = this.configRepo.create({ key, value });
        } else {
            config.value = value;
        }

        await this.configRepo.save(config);
        return config.value;
    }
    async delete(key: string): Promise<void> {
        await this.configRepo.delete({ key });
    }

    // ✅ NUEVO MÉTODO para año de inicio
    async getStartCountingYear(): Promise<{ year: number } | null> {
        const raw = await this.get('start-counting-year');
        if (!raw) return null;

        const parsedYear = parseInt(raw, 10);
        if (isNaN(parsedYear)) return null;

        return { year: parsedYear };
    }


}
