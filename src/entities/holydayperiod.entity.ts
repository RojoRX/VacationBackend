import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { DateTime } from 'luxon';

export enum HolidayPeriodName {
  INVIERNO = 'INVIERNO',
  FINDEGESTION = 'FINDEGESTION',
}

@Entity()
export class HolidayPeriod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: HolidayPeriodName,
  })
  name: HolidayPeriodName;

  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz' })
  endDate: Date;

  @Column({ type: 'int' })
  year: number;

  setStartDate(date: string) {
    this.startDate = DateTime.fromISO(date).toJSDate();
  }
  
  setEndDate(date: string) {
    this.endDate = DateTime.fromISO(date).toJSDate();
  }
}
