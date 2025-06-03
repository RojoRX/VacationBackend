import { Controller, Get, Put, Param, Body, NotFoundException, Delete } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { UpdateSystemConfigDto } from './dto/update-config.dto';

@Controller('system-config')
export class SystemConfigController {
    constructor(private readonly configService: SystemConfigService) { }

    @Get(':key')
    async getConfig(@Param('key') key: string) {
        const value = await this.configService.get(key);
        if (value === null) {
            throw new NotFoundException(`Configuración con clave '${key}' no encontrada.`);
        }
        return { key, value };
    }

    @Put(':key')
    async setConfig(@Param('key') key: string, @Body() body: UpdateSystemConfigDto) {
        const updated = await this.configService.set(key, body.value);
        return { key, value: updated };
    }
    @Delete(':key')
    async deleteConfig(@Param('key') key: string) {
        await this.configService.delete(key);
        return { message: `Configuración '${key}' eliminada.` };
    }
}
