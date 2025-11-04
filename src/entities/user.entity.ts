import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { License } from './license.entity'; // Importa la entidad License
import { UserHolidayPeriod } from './userHolidayPeriod.entity';// Importa la entidad UserHolidayPeriod
import { VacationRequest } from './vacation_request.entity'; // Importa la entidad VacationRequest
import { Department } from './department.entity';
import { RoleEnum } from 'src/enums/role.enum';
import { Notification } from './notification.entity';
import { TipoEmpleadoEnum } from 'src/enums/type.enum';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AcademicUnit } from './academic-unit.entity';
import { Profession } from './profession.entity';
import { UserConfig } from './user-config.entity';
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @IsNotEmpty()
  ci: string;

  @Column({ type: 'date' })
  fecha_ingreso: string;

  @Column({ unique: true, nullable: true })  // Opcional pero único si se proporciona
  @IsEmail()  // Validación de formato (requiere class-validator)
  email?: string;

  @Column({ unique: true, nullable: true })
  @IsOptional()
  @IsString()
  username: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  password?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  celular: string;

  @ManyToOne(() => Profession, { nullable: true })
  @JoinColumn({ name: 'professionId' })
  profession: Profession;

  @Column({ nullable: true })
  position: string;

  @Column({ type: 'enum', enum: TipoEmpleadoEnum, nullable: true })
  tipoEmpleado?: TipoEmpleadoEnum;

  @OneToMany(() => UserHolidayPeriod, userHolidayPeriod => userHolidayPeriod.user)
  holidayPeriods: UserHolidayPeriod[];

  @OneToMany(() => License, (license) => license.user)
  licenses: License[];

  @OneToMany(() => VacationRequest, (vacationRequest) => vacationRequest.user)
  vacationRequests: VacationRequest[];

  @ManyToOne(() => Department, { nullable: true })
  department: Department;

  // En user.entity.ts
  @ManyToOne(() => AcademicUnit, { nullable: true })
  @JoinColumn({ name: 'academicUnitId' })
  academicUnit: AcademicUnit;


  @Column({ type: 'enum', enum: RoleEnum, default: RoleEnum.USER })
  role: RoleEnum; // Usa el enum para el rol del usuario

  @OneToMany(() => Notification, notification => notification.recipient)
  notifications: Notification[];

  // user.entity.ts
  @OneToOne(() => UserConfig, config => config.user, { cascade: true, eager: true })
  config: UserConfig;
   // === SOFT DELETE ===
  @Column({ type: 'boolean', default: false })
  deleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  @Column({ nullable: true })
  deletedBy?: number; // referencia opcional a user.id que borró el registro

}
