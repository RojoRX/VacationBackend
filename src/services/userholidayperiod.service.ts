// src/services/userholidayperiod.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Not, Repository } from 'typeorm';
import { UserHolidayPeriod } from 'src/entities/userholidayperiod.entity';
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
  console.log("Recibiendo startDate " + " " + startDate)
  console.log("Recibiendo endDate " + " " + endDate)
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

  console.log(`Después de formatear para almacenar: ${startDateToStore} - ${endDateToStore}`);

  const start = new Date(startDateToStore);
  const end = new Date(endDateToStore);

  console.log("Convirtiendo startDate a start " + " " + start)
  console.log("Convirtiendo endDate a end " + " " + end)
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

    console.log("Datos recibidos:", updateData.startDate, updateData.endDate);

    if (!existingPeriod) {
      throw new NotFoundException(`Período de receso con id ${id} no encontrado.`);
    }

    const user = updateData.userId
      ? await this.userRepository.findOne({ where: { id: updateData.userId } })
      : existingPeriod.user;

    if (!user) {
      throw new BadRequestException('El usuario especificado no existe.');
    }

    // 2. Función mejorada de normalización que maneja múltiples formatos
    const normalizeDate = (dateString: string | undefined, existingDate: Date): Date => {
      if (!dateString) {
        // Si no se proporciona nueva fecha, normalizar la existente
        const d = new Date(existingDate);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }

      // Intentar parsear la fecha en diferentes formatos
      let date: Date;

      // Intento 1: Formato ISO (con tiempo)
      date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
      }

      // Intento 2: Formato YYYY-MM-DD
      const parts = dateString.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Meses son 0-indexados
        const day = parseInt(parts[2], 10);

        date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }

      throw new Error('Formato de fecha no reconocido');
    };

    try {
      const startDate = normalizeDate(updateData.startDate, existingPeriod.startDate);
      const endDate = normalizeDate(updateData.endDate, existingPeriod.endDate);

      console.log("Fechas normalizadas:", startDate, endDate);

      // Validaciones de fechas
      if (startDate >= endDate) {
        throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
      }

      const year = startDate.getFullYear();

      // Actualizar el período
      existingPeriod.name = updateData.name ?? existingPeriod.name;
      existingPeriod.startDate = startDate;
      existingPeriod.endDate = endDate;
      existingPeriod.year = year;
      existingPeriod.user = user;

      // 4. Validación de nombre duplicado
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

      // 5. Validación de solapamiento
      const overlapping = await this.userHolidayPeriodRepository
        .createQueryBuilder('period')
        .where('period.user_id = :userId', { userId: user.id })
        .andWhere('period.year = :year', { year })
        .andWhere('period.id != :id', { id })
        .andWhere(
          '(:startDate <= period.endDate AND :endDate >= period.startDate)',
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          }
        )
        .getOne();

      if (overlapping) {
        throw new BadRequestException('Las fechas ingresadas se superponen con otro receso existente.');
      }

      return this.userHolidayPeriodRepository.save(existingPeriod);
    } catch (error) {
      if (error.message === 'Formato de fecha no reconocido') {
        throw new BadRequestException('Formato de fecha inválido. Use YYYY-MM-DD o formato ISO válido.');
      }
      throw error;
    }
  }



  async getUserHolidayPeriods(userId: number, year: number): Promise<UserHolidayPeriodDto[]> {
    console.log(`Buscando recesos para userId: ${userId}, year: ${year}`);

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
    console.log(`Buscando recesos para userId: ${userId}`); // Verifica el userId
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
