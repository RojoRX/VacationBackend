import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserHolidayPeriod } from './userholidayperiod.entity'; // Importa la entidad creada

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  ci: string;  // Carnet de identidad, usado como identificador único

  @Column({ type: 'date' })
  fecha_ingreso: string;  // Fecha de ingreso del usuario

  @Column({ unique: true })
  username: string;  // Nombre de usuario único para autenticación

  @Column()
  password: string;  // Contraseña encriptada para autenticación

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relación con recesos específicos
  @OneToMany(() => UserHolidayPeriod, userHolidayPeriod => userHolidayPeriod.user)
  holidayPeriods: UserHolidayPeriod[];
}
