// src/entities/vacation-rules-config.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class VacationRulesConfig {
  @PrimaryGeneratedColumn()
  id: number;

  // Si esta validación está activa, NO se permite pedir de gestiones posteriores
  @Column({ default: true })
  validarGestionesAnterioresConDias: boolean;
}
