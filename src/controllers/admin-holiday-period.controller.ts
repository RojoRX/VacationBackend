import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { AdministrativeHolidayPeriodService } from 'src/services/administrative-holiday-period.service';
import { AdministrativeHolidayPeriod } from 'src/entities/administrativeHolidayPeriod.entity';
import { CreateAdministrativeHolidayPeriodDto } from 'src/dto/create-administrative-holiday-period.dto';

@ApiTags('Recesos Administrativos')
@Controller('administrative-holiday-periods')
export class AdministrativeHolidayPeriodController {
  constructor(
    private readonly administrativeHolidayService: AdministrativeHolidayPeriodService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todos los recesos administrativos' })
  async getAll(): Promise<AdministrativeHolidayPeriod[]> {
    return this.administrativeHolidayService.getAllAdministrativeHolidayPeriods();
  }

  @Get(':year')
  @ApiOperation({ summary: 'Obtener recesos administrativos por año' })
  @ApiParam({ name: 'year', type: Number, example: 2025 })
  async getByYear(@Param('year', ParseIntPipe) year: number): Promise<AdministrativeHolidayPeriod[]> {
    return this.administrativeHolidayService.getAdministrativeHolidayPeriods(year);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo receso administrativo' })
  @ApiBody({ type: CreateAdministrativeHolidayPeriodDto })
  async create(
    @Body() dto: CreateAdministrativeHolidayPeriodDto,
  ): Promise<AdministrativeHolidayPeriod> {
    return this.administrativeHolidayService.createAdministrativeHolidayPeriod(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un receso administrativo existente' })
  @ApiParam({ name: 'id', type: Number })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: AdministrativeHolidayPeriod,
  ): Promise<AdministrativeHolidayPeriod> {
    return this.administrativeHolidayService.updateAdministrativeHolidayPeriod(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un receso administrativo por ID' })
  @ApiParam({ name: 'id', type: Number })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.administrativeHolidayService.deleteAdministrativeHolidayPeriod(id);
  }
}
