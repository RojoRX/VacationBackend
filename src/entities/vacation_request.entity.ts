import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from 'src/entities/user.entity'; // Asegúrate de tener la entidad User definida o ajusta según tu implementación.

@Entity()
export class VacationRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.vacationRequests)
  user: User;

  @Column()
  position: string;

  @Column({ type: 'date' })
  requestDate: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'int' })
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

  @Column({ type: 'boolean', default: false })
  approvedByHR: boolean;

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
}
