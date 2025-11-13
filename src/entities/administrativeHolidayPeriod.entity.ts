import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum AdministrativeHolidayName {
  INVIERNO_ADMIN = 'INVIERNO', 
  FINDEGESTION_ADMIN = 'FINDEGESTION',
}

@Entity()
export class AdministrativeHolidayPeriod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: AdministrativeHolidayName,
  })
  name: AdministrativeHolidayName;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ type: 'int' })
  year: number;

}
