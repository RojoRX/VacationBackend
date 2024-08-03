import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class NonHoliday {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'date' })
  date: string; // Fecha específica del día no hábil
}
