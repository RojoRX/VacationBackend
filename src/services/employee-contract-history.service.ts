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

        if (dto.endDate && dto.startDate > dto.endDate) {
            throw new BadRequestException('startDate no puede ser mayor a endDate');
        }

        // Ajustar automáticamente el endDate para contratos OTRO
        if (dto.contractType === 'OTRO') {
            const start = new Date(dto.startDate);
            const end = addYears(start, 1); // mismo día y mes del año siguiente
            dto.endDate = end.toISOString().split('T')[0];
        }

        // Validar solape de contratos
        // Validar solape de contratos (solo NORMAL)
        const existing = await this.contractRepo.find({
            where: { user: { id: user.id } }
        });

        for (const c of existing) {
            // Ignorar la validación si ambos son OTRO
            if (dto.contractType === 'OTRO' && c.contractType === 'OTRO') continue;

            const startA = new Date(dto.startDate);
            const endA = dto.endDate ? new Date(dto.endDate) : new Date('9999-12-31');
            const startB = new Date(c.startDate);
            const endB = c.endDate ? new Date(c.endDate) : new Date('9999-12-31');

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

        if (dto.startDate && dto.endDate && new Date(dto.startDate) > new Date(dto.endDate)) {
            throw new BadRequestException('startDate no puede ser mayor a endDate');
        }

        // Ajustar automáticamente el endDate para contratos OTRO
        if (dto.contractType === 'OTRO' && dto.startDate) {
            const start = new Date(dto.startDate);
            const end = addYears(start, 1); // mismo día y mes del año siguiente
            dto.endDate = end.toISOString().split('T')[0];
        }

        // Validar solape de contratos actualizando
        const existing = await this.contractRepo.find({
            where: { user: { id: record.user.id } }
        });
        for (const c of existing) {
            // Ignorar la validación si ambos son OTRO
            if (dto.contractType === 'OTRO' && c.contractType === 'OTRO') continue;

            const startA = new Date(dto.startDate);
            const endA = dto.endDate ? new Date(dto.endDate) : new Date('9999-12-31');
            const startB = new Date(c.startDate);
            const endB = c.endDate ? new Date(c.endDate) : new Date('9999-12-31');

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
