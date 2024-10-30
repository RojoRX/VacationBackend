import { Injectable, NotFoundException } from '@nestjs/common'; 
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VacationPolicy } from 'src/entities/vacationPolicy.entity';

@Injectable()
export class VacationPolicyService {
  constructor(
    @InjectRepository(VacationPolicy)
    private readonly vacationPolicyRepository: Repository<VacationPolicy>,
  ) {}

  // Crear una nueva política de vacaciones
  async createPolicy(minYears: number, maxYears: number | null, vacationDays: number): Promise<VacationPolicy> {
    const newPolicy = this.vacationPolicyRepository.create({ minYears, maxYears, vacationDays });
    return await this.vacationPolicyRepository.save(newPolicy);
  }

  // Obtener todas las políticas de vacaciones
  async getAllPolicies(): Promise<VacationPolicy[]> {
    return await this.vacationPolicyRepository.find();
  }

  // Obtener política de vacaciones por ID
  async getPolicyById(id: number): Promise<VacationPolicy> {
    const policy = await this.vacationPolicyRepository.findOne({ where: { id } });
    if (!policy) {
      throw new NotFoundException('Vacation policy not found');
    }
    return policy;
  }

  // Obtener los días de vacaciones según años de servicio
  async getVacationDaysByYearsOfService(yearsOfService: number): Promise<number> {
    const policy = await this.vacationPolicyRepository
      .createQueryBuilder('policy')
      .where('policy.minYears <= :yearsOfService', { yearsOfService })
      .andWhere('policy.maxYears IS NULL OR policy.maxYears >= :yearsOfService', { yearsOfService })
      .getOne();

    if (!policy) {
      throw new NotFoundException('Vacation policy not found for the specified years of service');
    }

    return policy.vacationDays;
  }

  // Obtener política de vacaciones por años de servicio
  async getPolicyByYears(yearsOfService: number): Promise<VacationPolicy | null> {
    return await this.vacationPolicyRepository
      .createQueryBuilder('policy')
      .where('policy.minYears <= :yearsOfService', { yearsOfService })
      .andWhere('policy.maxYears IS NULL OR policy.maxYears >= :yearsOfService', { yearsOfService })
      .getOne(); // Retorna la política o null si no se encuentra
  }

  // Actualizar una política de vacaciones existente
  async updatePolicy(id: number, minYears: number, maxYears: number | null, vacationDays: number): Promise<VacationPolicy> {
    const policy = await this.getPolicyById(id);
    policy.minYears = minYears;
    policy.maxYears = maxYears;
    policy.vacationDays = vacationDays;
    return await this.vacationPolicyRepository.save(policy);
  }

  // Eliminar una política de vacaciones
  async deletePolicy(id: number): Promise<void> {
    const result = await this.vacationPolicyRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Vacation policy not found');
    }
  }
}
