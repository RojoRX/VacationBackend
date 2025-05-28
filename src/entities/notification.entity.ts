// notification.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
// notification.entity.ts
@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  message: string; // 👈 Esto es necesario

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, user => user.notifications, { eager: false })
  recipient: User;

  @ManyToOne(() => User, { nullable: true, eager: false })
  sender?: User;

  @Column({ nullable: true })
  resourceType?: 'VACATION' | 'LICENSE'; // o 'PERMISO' según tu terminología

  @Column({ nullable: true })
  resourceId?: number;

}


