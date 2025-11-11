import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from 'src/entities/user.entity';

@Entity()
export class VacationRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.vacationRequests)
  user: User;

  @Column({ nullable: true })
  position: string;

  @Column({ type: 'date' })
  requestDate: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  totalDays: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'AUTHORIZED', 'POSTPONED', 'DENIED', 'SUSPENDED'],
    default: 'PENDING',
  })
  status: string;

  @Column({ type: 'date', nullable: true })
  postponedDate?: string;

  @Column({ type: 'text', nullable: true })
  postponedReason?: string;

  @Column({ type: 'date' })
  returnDate: string;

  @Column({ type: 'boolean', nullable: true, default: null })
  approvedByHR: boolean | null;

  @Column({ type: 'boolean', default: false })
  approvedBySupervisor: boolean;

  @ManyToOne(() => User, { nullable: true })
  approvedBy: User;

  // Campo para almacenar el período de gestión de la solicitud
  @Column({ type: 'date' })
  managementPeriodStart: string;

  @Column({ type: 'date' })
  managementPeriodEnd: string;

  // Nuevo campo para la fecha de revisión
  @Column({ type: 'date', nullable: true })
  reviewDate?: string;

  // RELACIÓN CON SUPERVISOR - CORREGIDA
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'supervisorId' })
  supervisor?: User;

  // COLUMNA QUE FALTABA - Foreign Key para el supervisor
  @Column({ nullable: true })
  supervisorId: number;

  @Column({ default: false })
  deleted: boolean;
}