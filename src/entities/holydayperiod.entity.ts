import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum HolidayPeriodName {
  INVIERNO = 'INVIERNO',
  FINDEGESTION = 'FINDEGESTION',
}

@Entity()
export class HolidayPeriod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: HolidayPeriodName })
  name: HolidayPeriodName;

  @Column({ type: 'timestamptz' }) // Almacenar fecha y hora en UTC
  startDate: Date;

  @Column({ type: 'timestamptz' }) // Almacenar fecha y hora en UTC
  endDate: Date;

  @Column({ type: 'int' })
  year: number;
}
