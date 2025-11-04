// src/services/userholidayperiod.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Not, Repository } from 'typeorm';
// ✅ CORREGIR (nombre exacto)
import { UserHolidayPeriod } from '../entities/userHolidayPeriod.entity';
import { User } from 'src/entities/user.entity';
import { HolidayPeriodName } from 'src/entities/holydayperiod.entity'; // Asegúrate de importar el enum desde el archivo correcto
import { UserHolidayPeriodDto } from 'src/dto/userholidayperiod.dto';
import { DateTime } from 'luxon';
import { UpdateUserHolidayPeriodDto } from 'src/dto/updateUserHolidayPeriod.dto';
@Injectable()
export class UserHolidayPeriodService {
  constructor(
    @InjectRepository(UserHolidayPeriod)
    private userHolidayPeriodRepository: Repository<UserHolidayPeriod>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) { }

async createUserHolidayPeriod(createHolidayPeriodDto: {
  name: HolidayPeriodName;
  startDate: string;
  endDate: string;
  userId: number;
}): Promise<UserHolidayPeriod> {
  const { name, startDate, endDate, userId } = createHolidayPeriodDto;

  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user) {
    throw new BadRequestException('El usuario especificado no existe.');
  }

  // Función para normalizar a medianoche (00:00:00)
  const normalizeToMidnight = (dateStr: string): string => {
    const date = new Date(dateStr);
    const normalized = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    ));
    return normalized.toISOString().slice(0, 19).replace('T', ' ');
  };

  const startDateToStore = normalizeToMidnight(startDate);
  const endDateToStore = normalizeToMidnight(endDate);


  const start = new Date(startDateToStore);
  const end = new Date(endDateToStore);


  if (start >= end) {
    throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
  }

  const year = start.getUTCFullYear();

  // Verificar si ya existe un período con ese nombre para el mismo año y usuario
  const existingPeriod = await this.userHolidayPeriodRepository.findOne({
    where: {
      user: { id: userId },
      year,
      name,
    },
  });

  if (existingPeriod) {
    throw new BadRequestException(
      `Ya existe un receso específico de ${name} para este usuario en el año ${year}.`
    );
  }

  // Verificar solapamiento de fechas para ese usuario
  const overlappingPeriods = await this.userHolidayPeriodRepository
    .createQueryBuilder('period')
    .where('period.user_id = :userId', { userId })
    .andWhere('period.year = :year', { year })
    .andWhere(
      '(:startDate <= period.endDate AND :endDate >= period.startDate)',
      { startDate: start.toISOString(), endDate: end.toISOString() }
    )
    .getOne();

  if (overlappingPeriods) {
    throw new BadRequestException('Las fechas ingresadas se superponen con otro receso existente.');
  }

  const newHolidayPeriod = this.userHolidayPeriodRepository.create({
    user,
    startDate: startDateToStore,
    endDate: endDateToStore,
    name,
    year,
  });

  return this.userHolidayPeriodRepository.save(newHolidayPeriod);
}

async updateUserHolidayPeriod(
  id: number,
  updateData: {
    name?: HolidayPeriodName;
    startDate?: string;
    endDate?: string;
    userId?: number;
  }
): Promise<UserHolidayPeriod> {
  // 1. Buscar el período existente
  const existingPeriod = await this.userHolidayPeriodRepository.findOne({
    where: { id },
    relations: ['user'],
  });


  if (!existingPeriod) {
    throw new NotFoundException(`Período de receso con id ${id} no encontrado.`);
  }

  const user = updateData.userId
    ? await this.userRepository.findOne({ where: { id: updateData.userId } })
    : existingPeriod.user;

  if (!user) {
    throw new BadRequestException('El usuario especificado no existe.');
  }

  // 2. Función de normalización mejorada
  const normalizeDateInput = (dateString: string): Date => {
    if (!dateString) throw new Error('Fecha no proporcionada');
    
    // Extraer componentes de fecha ignorando zona horaria
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    
    // Crear fecha en UTC explícita
    return new Date(Date.UTC(year, month - 1, day));
  };

  try {
    const startDate = updateData.startDate ? normalizeDateInput(updateData.startDate) : new Date(existingPeriod.startDate);
    const endDate = updateData.endDate ? normalizeDateInput(updateData.endDate) : new Date(existingPeriod.endDate);


    // Ajustar para almacenamiento en BD (formato YYYY-MM-DD HH:MM:SS)
    const formatForDB = (date: Date): string => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} 00:00:00`;
    };

    const startDateForDB = formatForDB(startDate);
    const endDateForDB = formatForDB(endDate);



    // Validaciones de fechas
    if (startDate >= endDate) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
    }

    const year = startDate.getUTCFullYear();

    // Actualizar el período con fechas normalizadas
    existingPeriod.name = updateData.name ?? existingPeriod.name;
    existingPeriod.startDate = startDateForDB as unknown as Date; // Conversión necesaria para TypeORM
    existingPeriod.endDate = endDateForDB as unknown as Date;
    existingPeriod.year = year;
    existingPeriod.user = user;

    // Validación de nombre duplicado
    const duplicateName = await this.userHolidayPeriodRepository.findOne({
      where: {
        user: { id: user.id },
        year,
        name: existingPeriod.name,
      },
    });

    if (duplicateName && duplicateName.id !== id) {
      throw new BadRequestException(
        `Ya existe un receso específico de ${existingPeriod.name} para este usuario en el año ${year}.`
      );
    }

    // Validación de solapamiento (usando fechas UTC)
    const overlapping = await this.userHolidayPeriodRepository
      .createQueryBuilder('period')
      .where('period.user_id = :userId', { userId: user.id })
      .andWhere('period.year = :year', { year })
      .andWhere('period.id != :id', { id })
      .andWhere(
        '(:startDate <= period.endDate AND :endDate >= period.startDate)',
        {
          startDate: startDateForDB,
          endDate: endDateForDB
        }
      )
      .getOne();

    if (overlapping) {
      throw new BadRequestException('Las fechas ingresadas se superponen con otro receso existente.');
    }

    return this.userHolidayPeriodRepository.save(existingPeriod);
  } catch (error) {
    console.error('Error en updateUserHolidayPeriod:', error);
    if (error.message === 'Fecha no proporcionada') {
      throw new BadRequestException('Formato de fecha inválido. Use YYYY-MM-DD');
    }
    throw error;
  }
}

  async getUserHolidayPeriods(userId: number, year: number): Promise<UserHolidayPeriodDto[]> {


    const result = await this.userHolidayPeriodRepository.find({
      where: { user: { id: userId }, year },
    });

    // Map results to UserHolidayPeriodDto
    return result.map(holidayPeriod => ({
      id: holidayPeriod.id,
      name: holidayPeriod.name,
      startDate: holidayPeriod.startDate,
      endDate: holidayPeriod.endDate,
      year: holidayPeriod.year,
    }));
  }

  async deleteUserHolidayPeriod(id: number): Promise<void> {
    const result = await this.userHolidayPeriodRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Receso con id ${id} no encontrado.`);
    }
  }


  async getAllUserHolidayPeriods(userId: number): Promise<UserHolidayPeriodDto[]> {
    //console.log(`Buscando recesos para userId: ${userId}`); // Verifica el userId
    const result = await this.userHolidayPeriodRepository.find({
      where: { user: { id: userId } }, // Realiza la consulta
    });

    // Mapea los resultados a UserHolidayPeriodDto
    return result.map(holidayPeriod => ({
      id: holidayPeriod.id,
      name: holidayPeriod.name,
      startDate: holidayPeriod.startDate,
      endDate: holidayPeriod.endDate,
      year: holidayPeriod.year,
    }));
  }


}
