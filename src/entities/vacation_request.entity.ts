// vacation_request.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from 'src/entities/user.entity'; // Asegúrate de tener la entidad User definida o ajusta según tu implementación.

@Entity()
export class VacationRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, user => user.vacationRequests) // Relación con la entidad User
  user: User;

  @Column()
  position: string; // Cargo del usuario

  @Column({ type: 'date' })
  requestDate: string; // Fecha de solicitud

  @Column({ type: 'date' })
  startDate: string; // Fecha de inicio de vacaciones

  @Column({ type: 'date' })
  endDate: string; // Fecha de fin de vacaciones

  @Column({ type: 'int' })
  totalDays: number; // Días totales calculados de vacaciones

  @Column({ 
    type: 'enum', 
    enum: ['PENDING', 'AUTHORIZED', 'POSTPONED', 'DENIED', 'SUSPENDED'], 
    default: 'PENDING' // Cambiado a 'PENDING' para mayor claridad
  })
  status: string; // Estado de la solicitud

  @Column({ type: 'date', nullable: true })
  postponedDate?: string; // Fecha de postergación, si aplica

  @Column({ type: 'text', nullable: true })
  postponedReason?: string; // Justificación de postergación, si aplica

  @Column({ type: 'date' })
  returnDate: string; // Fecha de retorno calculada

  @Column({ type: 'boolean', default: false })
  approvedByHR: boolean; // Indicador de aprobación por RRHH
}
