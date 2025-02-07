// src/services/userholidayperiod.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserHolidayPeriod } from 'src/entities/userholidayperiod.entity';
import { User } from 'src/entities/user.entity';
import { HolidayPeriodName } from 'src/entities/holydayperiod.entity'; // Asegúrate de importar el enum desde el archivo correcto
import { UserHolidayPeriodDto } from 'src/dto/userholidayperiod.dto';

@Injectable()
export class UserHolidayPeriodService {
  constructor(
    @InjectRepository(UserHolidayPeriod)
    private userHolidayPeriodRepository: Repository<UserHolidayPeriod>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createUserHolidayPeriod(createHolidayPeriodDto: { 
    name: HolidayPeriodName; 
    startDate: string; 
    endDate: string; 
    userId: number; 
  }): Promise<UserHolidayPeriod> {
    // Busca el usuario correspondiente
    const user = await this.userRepository.findOne({ where: { id: createHolidayPeriodDto.userId } });
    if (!user) {
      throw new BadRequestException('El usuario especificado no existe.');
    }
  
    // Verifica que la fecha de inicio sea anterior a la fecha de fin
    if (new Date(createHolidayPeriodDto.startDate) >= new Date(createHolidayPeriodDto.endDate)) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
    }
  
    // Calcular el año a partir de la fecha de inicio
    const year = new Date(createHolidayPeriodDto.startDate).getFullYear();
  
    // Verificar si ya existe un período de vacaciones del mismo tipo para el año especificado
    const existingPeriod = await this.userHolidayPeriodRepository.findOne({
      where: { 
        user: { id: createHolidayPeriodDto.userId }, 
        year, 
        name: createHolidayPeriodDto.name 
      },
    });
  
    if (existingPeriod) {
      throw new BadRequestException(`Ya existe un receso específico de ${createHolidayPeriodDto.name} para este usuario en el año ${year}.`);
    }
  
    // Crea un nuevo período de vacaciones con el usuario asignado
    const newHolidayPeriod = this.userHolidayPeriodRepository.create({
      user,
      startDate: new Date(createHolidayPeriodDto.startDate),
      endDate: new Date(createHolidayPeriodDto.endDate),
      name: createHolidayPeriodDto.name,
      year,
    });
  
    // Guarda el nuevo período de vacaciones en la base de datos
    return this.userHolidayPeriodRepository.save(newHolidayPeriod);
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

  async updateUserHolidayPeriod(id: number, holidayPeriod: Partial<UserHolidayPeriod>): Promise<UserHolidayPeriod> {
    const existingPeriod = await this.userHolidayPeriodRepository.findOne({ where: { id } });
    if (!existingPeriod) {
      throw new NotFoundException(`Receso con id ${id} no encontrado.`);
    }
  
    // Si se proporciona una nueva fecha de inicio, recalcular el año
    if (holidayPeriod.startDate) {
      holidayPeriod.year = new Date(holidayPeriod.startDate).getFullYear();
    }
  
    await this.userHolidayPeriodRepository.update(id, holidayPeriod);
    return this.userHolidayPeriodRepository.findOne({ where: { id } });
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
