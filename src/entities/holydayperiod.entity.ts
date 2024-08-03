import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { DateTime } from 'luxon';

export enum HolidayPeriodName {
  INVIERNO = 'INVIERNO',
  FINDEGESTION = 'FINDEGESTION',
}

export enum HolidayPeriodType {
  GENERAL = 'general',
  SPECIFIC = 'specific',
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

  @Column({
    type: 'enum',
    enum: HolidayPeriodType,
  })
  type: HolidayPeriodType;

  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz' })
  endDate: Date;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  career: string; // Nombre de la carrera si es específico, null si es general

  setStartDate(date: string) {
    this.startDate = DateTime.fromISO(date).toJSDate();
  }
  
  setEndDate(date: string) {
    this.endDate = DateTime.fromISO(date).toJSDate();
  }
}
