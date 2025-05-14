import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';
import { Repository, Not, Between } from 'typeorm';
import { HolidayPeriodName } from 'src/entities/generalHolidayPeriod.entity';
import { async } from 'rxjs';
import { CreateGeneralHolidayPeriodDto } from 'src/dto/create-general-holiday-period.dto';
import toLocalDateOnly from 'src/utils/normalizaedDate';

@Injectable()
export class GeneralHolidayPeriodService {
  constructor(
    @InjectRepository(GeneralHolidayPeriod)
    private readonly generalHolidayPeriodRepository: Repository<GeneralHolidayPeriod>,
  ) { }

  async createGeneralHolidayPeriod(dto: CreateGeneralHolidayPeriodDto): Promise<GeneralHolidayPeriod> {
    if (!dto.name || !dto.startDate || !dto.endDate) {
      throw new BadRequestException('Todos los campos son obligatorios (excepto el año, que se calculará automáticamente).');
    }
  
    if (!Object.values(HolidayPeriodName).includes(dto.name as HolidayPeriodName)) {
      throw new BadRequestException(`El nombre del receso debe ser uno de los siguientes: ${Object.values(HolidayPeriodName).join(', ')}`);
    }
    console.log(`Antes de la conversion ${dto.startDate} - ${dto.endDate}`)
    const start = toLocalDateOnly(dto.startDate);
    const end = toLocalDateOnly(dto.endDate);
    console.log(`Despues de la conversion ${start} - ${end}`)
  
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Las fechas deben ser válidas.');
    }
  
    if (start >= end) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
    }
  
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (duration > 30) {
      throw new BadRequestException('El receso no puede exceder los 30 días.');
    }
  
    const year = start.getFullYear();
  
    // Validar el rango del año extraído
    if (year < 2000 || year > 2100) {
      throw new BadRequestException('El año del receso debe estar entre 2000 y 2100.');
    }
  
    // Verificar duplicado exacto
    const existingByName = await this.generalHolidayPeriodRepository.findOne({
      where: {
        year,
        name: dto.name as HolidayPeriodName,
      },
    });
  
    if (existingByName) {
      throw new BadRequestException(`Ya existe un receso general de "${dto.name}" para el año ${year}.`);
    }
  
    // Verificar solapamiento de fechas en el mismo año
    const overlapping = await this.generalHolidayPeriodRepository.findOne({
      where: {
        year,
        startDate: Between(start, end),
      },
    });
  
    if (overlapping) {
      throw new BadRequestException('Las fechas se superponen con otro receso general en el mismo año.');
    }
  
    // Crear y guardar
    const newPeriod = this.generalHolidayPeriodRepository.create({
      ...dto,
      name: dto.name as HolidayPeriodName,
      startDate: start,
      endDate: end,
      year,
    });
  
    return this.generalHolidayPeriodRepository.save(newPeriod);
  } 
  // Obtener todos los recesos para un año específico
  async getGeneralHolidayPeriods(year: number): Promise < GeneralHolidayPeriod[] > {
  const periods = await this.generalHolidayPeriodRepository.find({ where: { year } });

  if(!periods.length) {
  throw new NotFoundException(`No se encontraron recesos generales para el año ${year}.`);
}

return periods;
  }

  // Obtener todos los recesos existentes (sin filtrar por año)
  async getAllGeneralHolidayPeriods(): Promise < GeneralHolidayPeriod[] > {
  return this.generalHolidayPeriodRepository.find();
}

  // Actualizar un receso general existente
  async updateGeneralHolidayPeriod(id: number, holidayPeriod: GeneralHolidayPeriod): Promise<GeneralHolidayPeriod> {
    const existingPeriod = await this.generalHolidayPeriodRepository.findOne({ where: { id } });
  
    if (!existingPeriod) {
      throw new NotFoundException(`Receso con id ${id} no encontrado.`);
    }
  
    // Obtener año automáticamente a partir de startDate
    const start = new Date(holidayPeriod.startDate);
    const end = new Date(holidayPeriod.endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Las fechas deben ser válidas.');
    }
  
    // Calcular el año basado en la fecha de inicio
    const year = start.getFullYear();
    
    // Validaciones de fechas
    if (start >= end) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
    }
  
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (duration > 30) {
      throw new BadRequestException('El receso no puede exceder los 30 días.');
    }
  
    // Verificar si ya existe otro receso con el mismo nombre y año (para evitar duplicados exactos)
    const conflictingPeriod = await this.generalHolidayPeriodRepository.findOne({
      where: { year, name: holidayPeriod.name, id: Not(id) },
    });
  
    if (conflictingPeriod) {
      throw new BadRequestException(`Ya existe un receso general de "${holidayPeriod.name}" para el año ${year}.`);
    }
  
    // Verificar si las fechas del nuevo receso se superponen con algún otro receso en el mismo año
    const overlapping = await this.generalHolidayPeriodRepository.findOne({
      where: {
        year,
        startDate: Between(start, end),
        id: Not(id),  // No debe solaparse con el mismo receso
      },
    });
  
    if (overlapping) {
      throw new BadRequestException('Las fechas se superponen con otro receso general en el mismo año.');
    }
  
    // Actualizar el receso con los nuevos datos
    const updatedPeriod = this.generalHolidayPeriodRepository.create({
      ...holidayPeriod,
      year,  // Aseguramos que el año esté actualizado correctamente
      startDate: toLocalDateOnly(start),
      endDate: toLocalDateOnly(end),
    });
  
    await this.generalHolidayPeriodRepository.update(id, updatedPeriod);
    return this.generalHolidayPeriodRepository.findOne({ where: { id } });
  }
  

  // Eliminar un receso general
  async deleteGeneralHolidayPeriod(id: number): Promise < void> {
  const existingPeriod = await this.generalHolidayPeriodRepository.findOne({ where: { id } });

  if(!existingPeriod) {
    throw new NotFoundException(`Receso con id ${id} no encontrado.`);
  }

    await this.generalHolidayPeriodRepository.delete(id);
}


}
