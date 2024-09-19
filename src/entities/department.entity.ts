// src/entities/department.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

@Entity()
export class Department {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'boolean', default: false })
  isCareer: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validateName() {
    const invalidCharacters = /[^a-zA-Z0-9\s]/; // Permite solo letras, números y espacios
    if (invalidCharacters.test(this.name)) {
      throw new BadRequestException('Department name contains invalid characters');
    }
    this.name = this.name.toUpperCase();
  }
}
