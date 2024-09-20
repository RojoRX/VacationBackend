import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, BeforeInsert, BeforeUpdate } from 'typeorm';
import { User } from './user.entity';
import { BadRequestException } from '@nestjs/common';

export enum LicenseType {
  VACATION = 'VACACION',
  OTHER = 'OTRO',
}

export enum TimeRequest {
  HALF_DAY = 'Medio Día',
  FULL_DAY = 'Día Completo',
  MULTIPLE_DAYS = 'Varios Días',
}

@Entity()
export class License {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: LicenseType,
    default: LicenseType.VACATION,
  })
  licenseType: LicenseType;

  @Column({
    type: 'enum',
    enum: TimeRequest,
    default: TimeRequest.FULL_DAY,
  })
  timeRequested: TimeRequest;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'numeric', default: 0 }) 
  totalDays: number;

  @CreateDateColumn()
  issuedDate: Date;

  // Aprobación del supervisor inmediato
  @Column({ type: 'boolean', default: false })
  immediateSupervisorApproval: boolean;

  // Aprobación del administrador del sistema
  @Column({ type: 'boolean', default: false })
  personalDepartmentApproval: boolean;

  // Relación con el usuario que solicita la licencia
  @ManyToOne(() => User, (user) => user.licenses)
  user: User;

  // Nuevo: Relación con el supervisor que aprobó la licencia
  @ManyToOne(() => User, { nullable: true }) // Opcional al momento de crear la licencia
  approvedBySupervisor: User; // El supervisor que aprobó la licencia
}
