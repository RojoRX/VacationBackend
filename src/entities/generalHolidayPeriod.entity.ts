import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { DateTime } from 'luxon';

export enum HolidayPeriodName {
  INVIERNO = 'INVIERNO',
  FINDEGESTION = 'FINDEGESTION',
}

@Entity()
export class GeneralHolidayPeriod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: HolidayPeriodName,
  })
  name: HolidayPeriodName;

  @Column({ type: 'timestamp' }) // Cambiado a timestamp
  startDate: Date;

  @Column({ type: 'timestamp' }) // Cambiado a timestamp
  endDate: Date;


  @Column({ type: 'int' })
  year: number;

}
