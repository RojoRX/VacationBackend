import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { HolidayPeriodName } from './holydayperiod.entity'; // Asegúrate de importar el enum desde el archivo correcto
import { DateTime } from 'luxon';

@Entity('user_holiday_periods')
export class UserHolidayPeriod {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, user => user.holidayPeriods)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: HolidayPeriodName,
  })
  name: HolidayPeriodName;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ type: 'int' })
  year: number;
  
  // Métodos para establecer fechas usando Luxon
  setStartDate(date: string) {
    this.startDate = DateTime.fromISO(date).toJSDate();
  }
  
  setEndDate(date: string) {
    this.endDate = DateTime.fromISO(date).toJSDate();
  }
}
