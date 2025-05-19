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

    const startDateUTC = new Date(startDate);
    const endDateUTC = new Date(endDate);

    // Obtener la representación ISO 8601 sin la 'Z' para almacenar
    const startDateToStore = startDateUTC.toISOString().slice(0, 19).replace('T', ' ');
    const endDateToStore = endDateUTC.toISOString().slice(0, 19).replace('T', ' ');

    console.log(`Después de formatear para almacenar: ${startDateToStore} - ${endDateToStore}`);

    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log("Convirtiendo startDate a start " + " " + start)
    console.log("Convirtiendo endDate a end " + " " + end)
    if (start >= end) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
    }

    const year = start.getFullYear();

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

    // 🔍 Verificar solapamiento de fechas para ese usuario
    const overlappingPeriods = await this.userHolidayPeriodRepository
      .createQueryBuilder('period')
      .where('period.user_id = :userId', { userId })  // corregido
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

  const name = updateData.name ?? existingPeriod.name;
  const startDateRaw = updateData.startDate ?? existingPeriod.startDate.toISOString().slice(0, 10);
  const endDateRaw = updateData.endDate ?? existingPeriod.endDate.toISOString().slice(0, 10);

  // Logs de depuración
  console.log("Recibiendo startDate " + startDateRaw);
  console.log("Recibiendo endDate " + endDateRaw);

  const start = new Date(startDateRaw);
  const end = new Date(endDateRaw);

  // Validaciones de fechas
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new BadRequestException('Formato de fecha inválido (use YYYY-MM-DD)');
  }

  if (start >= end) {
    throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
  }

  const year = start.getFullYear();

  // Eliminar la "Z" para que no se registre en UTC en la BD (desfase)
  const startDateToStore = start.toISOString().slice(0, 19).replace('T', ' ');
  const endDateToStore = end.toISOString().slice(0, 19).replace('T', ' ');

  console.log(`Formateado para almacenar: ${startDateToStore} - ${endDateToStore}`);

  // Validación de nombre duplicado en el mismo año y usuario (excluyendo el actual)
  const duplicateName = await this.userHolidayPeriodRepository.findOne({
    where: {
      user: { id: user.id },
      year,
      name,
    },
  });

  if (duplicateName && duplicateName.id !== id) {
    throw new BadRequestException(
      `Ya existe un receso específico de ${name} para este usuario en el año ${year}.`
    );
  }

  // Validación de solapamiento (excluyendo el actual)
  const overlapping = await this.userHolidayPeriodRepository
    .createQueryBuilder('period')
    .where('period.user_id = :userId', { userId: user.id })
    .andWhere('period.year = :year', { year })
    .andWhere('period.id != :id', { id })
    .andWhere(
      '(:startDate <= period.endDate AND :endDate >= period.startDate)',
      {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      }
    )
    .getOne();

  if (overlapping) {
    throw new BadRequestException('Las fechas ingresadas se superponen con otro receso existente.');
  }

  // Actualizar el período
  existingPeriod.name = name;
  existingPeriod.startDate = startDateToStore as unknown as Date;
  existingPeriod.endDate = endDateToStore as unknown as Date;
  existingPeriod.year = year;
  existingPeriod.user = user;

  return this.userHolidayPeriodRepository.save(existingPeriod);
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
