// src/entities/employee-contract-history.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { ContractType } from 'src/enums/contract-type.enum';

@Entity('employee_contract_history')
export class EmployeeContractHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'date' })
  startDate: string; // formato YYYY-MM-DD sin horas

  @Column({ type: 'date', nullable: true })
  endDate?: string; // si es null, contrato sigue vigente

  @Column({
    type: 'enum',
    enum: ContractType,
    default: ContractType.OTRO
  })
  contractType: ContractType;
}
