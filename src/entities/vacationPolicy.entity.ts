import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('vacation_policy')
export class VacationPolicy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  minYears: number;

  @Column({ type: 'int', nullable: true })
  maxYears: number;

  @Column({ type: 'int' })
  vacationDays: number;
}
