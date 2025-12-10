// src/services/employee-contract-history.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeContractHistory } from 'src/entities/employee-contract-history.entity';
import { User } from 'src/entities/user.entity';
import { CreateEmployeeContractHistoryDto } from 'src/dto/create-employee-contract-history.dto';
import { UpdateEmployeeContractHistoryDto } from 'src/dto/update-employee-contract-history.dto';
import { addYears } from 'date-fns';

@Injectable()
export class EmployeeContractHistoryService {
    constructor(
        @InjectRepository(EmployeeContractHistory)
        private readonly contractRepo: Repository<EmployeeContractHistory>,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    async create(dto: CreateEmployeeContractHistoryDto) {
        const user = await this.userRepo.findOne({ where: { id: dto.userId } });
        if (!user) throw new NotFoundException('Usuario no encontrado');

        // Convertir fechas a UTC explícitamente
        const startDateUTC = new Date(dto.startDate + 'T00:00:00Z'); // ← FORZAR UTC
        if (dto.endDate) {
            const endDateUTC = new Date(dto.endDate + 'T00:00:00Z');
            if (startDateUTC > endDateUTC) {
                throw new BadRequestException('startDate no puede ser mayor a endDate');
            }
        }

        // Ajustar automáticamente el endDate para contratos OTRO
        if (dto.contractType === 'OTRO') {
            // Usar UTC para cálculos
            const start = startDateUTC;
            const end = new Date(Date.UTC(
                start.getUTCFullYear() + 1,  // Año siguiente
                start.getUTCMonth(),          // Mismo mes
                start.getUTCDate()            // Mismo día
            ));

            // Verificar si la fecha es válida en UTC
            if (end.getUTCMonth() !== start.getUTCMonth() || end.getUTCDate() !== start.getUTCDate()) {
                // Si no es válida (ej: 31 de marzo en febrero bisiesto)
                // Usar último día del mes anterior
                end.setUTCDate(0); // Último día del mes anterior
            }

            // Formato YYYY-MM-DD sin zona horaria
            dto.endDate = end.toISOString().split('T')[0];
        }

        // Validar solape de contratos (solo NORMAL)
        const existing = await this.contractRepo.find({
            where: { user: { id: user.id } }
        });

        for (const c of existing) {
            // Ignorar la validación si ambos son OTRO
            if (dto.contractType === 'OTRO' && c.contractType === 'OTRO') continue;

            // Usar UTC para comparaciones
            const startA = startDateUTC;
            const endA = dto.endDate ? new Date(dto.endDate + 'T00:00:00Z') : new Date('9999-12-31T00:00:00Z');
            const startB = new Date(c.startDate + 'T00:00:00Z');
            const endB = c.endDate ? new Date(c.endDate + 'T00:00:00Z') : new Date('9999-12-31T00:00:00Z');

            const overlap = startA <= endB && endA >= startB;
            if (overlap) {
                throw new BadRequestException('Este contrato se solapa con otro existente');
            }
        }

        const newContract = this.contractRepo.create({
            user,
            ...dto,
        });

        return await this.contractRepo.save(newContract);
    }

    async findAllByUser(userId: number) {
        return this.contractRepo.find({
            where: { user: { id: userId } },
            order: { startDate: 'ASC' }
        });
    }

    async findOne(id: number) {
        const record = await this.contractRepo.findOne({ where: { id } });
        if (!record) throw new NotFoundException('Registro no encontrado');
        return record;
    }

    async update(id: number, dto: UpdateEmployeeContractHistoryDto) {
        const record = await this.findOne(id);

        // Validación básica de fechas
        if (dto.startDate && dto.endDate && dto.startDate > dto.endDate) {
            throw new BadRequestException('startDate no puede ser mayor a endDate');
        }

        // Ajustar automáticamente el endDate para contratos OTRO usando cálculo manual
        if (dto.contractType === 'OTRO' && dto.startDate) {
            // Parsear fecha manualmente sin usar Date
            const [yearStr, monthStr, dayStr] = dto.startDate.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10); // Mantener 1-indexed
            const day = parseInt(dayStr, 10);

            // Calcular año siguiente
            const nextYear = year + 1;

            // Verificar si el día existe en el mes del año siguiente
            // Usar Date solo para obtener días en el mes
            const daysInMonth = new Date(nextYear, month, 0).getDate();

            if (day > daysInMonth) {
                // Usar último día del mes
                dto.endDate = `${nextYear}-${month.toString().padStart(2, '0')}-${daysInMonth.toString().padStart(2, '0')}`;
            } else {
                // Mismo día existe
                dto.endDate = `${nextYear}-${month.toString().padStart(2, '0')}-${dayStr}`;
            }
        }

        // Validar solape de contratos actualizando
        const existing = await this.contractRepo.find({
            where: { user: { id: record.user.id } }
        });

        for (const c of existing) {
            // Ignorar el contrato actual que estamos actualizando
            if (c.id === id) continue;

            // Ignorar la validación si ambos son OTRO
            if (dto.contractType === 'OTRO' && c.contractType === 'OTRO') continue;

            // Usar fechas como strings para comparación
            const startA = dto.startDate || record.startDate;
            const endA = dto.endDate || record.endDate || '9999-12-31';
            const startB = c.startDate;
            const endB = c.endDate || '9999-12-31';

            // Comparar como strings (formato YYYY-MM-DD es comparable léxicamente)
            const overlap = startA <= endB && endA >= startB;
            if (overlap) {
                throw new BadRequestException('Este contrato se solapa con otro existente');
            }
        }

        Object.assign(record, dto);
        return await this.contractRepo.save(record);
    }

    async delete(id: number) {
        const record = await this.findOne(id);
        await this.contractRepo.remove(record);
        return { deleted: true };
    }

    async getContractsForUser(userId: number): Promise<EmployeeContractHistory[]> {
        if (!userId || isNaN(userId)) {
            throw new BadRequestException('El userId proporcionado no es válido.');
        }

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('El usuario no existe.');
        }

        const contracts = await this.contractRepo.find({
            where: { user: { id: userId } },
            order: { startDate: 'ASC' },
        });

        return contracts ?? [];
    }
}
