import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';

export enum LicenseType {
  VACATION = 'VACACION',
  OTHER = 'OTRO',
}

export enum TimeRequest {
  HALF_DAY = 'Medio Día',
  FULL_DAY = 'Día Completo',
  MULTIPLE_DAYS = 'Varios Días',
}

export enum HalfDayType {
  MORNING = 'Media Mañana',
  AFTERNOON = 'Media Tarde',
  NONE = 'Completo',
}

@Entity()
export class License {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: LicenseType, default: LicenseType.VACATION })
  licenseType: LicenseType;

  @Column({ type: 'enum', enum: TimeRequest, default: TimeRequest.FULL_DAY })
  timeRequested: TimeRequest;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'enum', enum: HalfDayType, default: HalfDayType.NONE })
  startHalfDay: HalfDayType;

  @Column({ type: 'enum', enum: HalfDayType, default: HalfDayType.NONE })
  endHalfDay: HalfDayType;

  @Column({ type: 'numeric', default: 0 })
  totalDays: number;

  @CreateDateColumn()
  issuedDate: Date;

  @Column({ type: 'boolean', nullable: true, default: null })
  immediateSupervisorApproval: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: null })
  personalDepartmentApproval: boolean | null;


  @ManyToOne(() => User, (user) => user.licenses)
  user: User;

  @ManyToOne(() => User, { nullable: true })
  approvedBySupervisor: User;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;
}
