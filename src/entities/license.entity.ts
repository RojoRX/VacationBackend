import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum LicenseType {
  VACATION = 'VACACION',
  OTHER = 'OTRO',
}

export enum TimeRequest {
  HALF_MORNING = 'Media Mañana',
  AFTERNOON = 'Media Tarde',
  FULL_DAY = '1 día',
  TWO_DAYS = '2 días',
  THREE_DAYS = '3 días',
  FOUR_DAYS = '4 días',
  FIVE_DAYS = '5 días',
}

@Entity()
export class License {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: LicenseType,
    default: LicenseType.OTHER,
  })
  licenseType: LicenseType;

  @Column()
  applicantName: string;

  @Column()
  applicantCI: string;

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

  @CreateDateColumn()
  issuedDate: Date;

  @Column({ type: 'boolean', default: false })
  immediateSupervisorApproval: boolean;

  @Column({ type: 'boolean', default: false })
  personalDepartmentApproval: boolean;
}
