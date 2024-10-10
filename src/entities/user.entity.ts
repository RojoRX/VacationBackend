import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { License } from './license.entity'; // Importa la entidad License
import { UserHolidayPeriod } from './userholidayperiod.entity'; // Importa la entidad UserHolidayPeriod
import { VacationRequest } from './vacation_request.entity'; // Importa la entidad VacationRequest
import { Department } from './department.entity';
import { RoleEnum } from 'src/enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  ci: string;

  @Column({ type: 'date' })
  fecha_ingreso: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  celular: string;

  @Column({ nullable: true })
  profesion: string;

  @Column({ nullable: true })
  position: string;


  @OneToMany(() => UserHolidayPeriod, userHolidayPeriod => userHolidayPeriod.user)
  holidayPeriods: UserHolidayPeriod[];

  @OneToMany(() => License, (license) => license.user)
  licenses: License[];

  @OneToMany(() => VacationRequest, (vacationRequest) => vacationRequest.user)
  vacationRequests: VacationRequest[];

  @ManyToOne(() => Department, { nullable: true })
  department: Department;

  @Column({ type: 'enum', enum: RoleEnum, default: RoleEnum.USER })
  role: RoleEnum; // Usa el enum para el rol del usuario

}
