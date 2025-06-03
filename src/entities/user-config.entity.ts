// user-config.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';

@Entity()
@Unique(['user'])
export class UserConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, user => user.config, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'int', nullable: true })
  customStartYear?: number;

  @Column({ type: 'int', nullable: true })
  initialVacationBalance?: number;
}
