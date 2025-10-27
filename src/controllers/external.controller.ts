import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ExternalService } from '../services/external.service';

class PersonResponseDto {
  ci: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  correo: string;
  telefono: string;
  direccion: string;
  genero: string;
  fechaNacimiento: string;
  profesion: string;
  nacionalidad: string;
  lugarNacimiento: string;
  foto: string;
}

@ApiTags('External')
@Controller('external')
export class ExternalController {
  constructor(private readonly externalService: ExternalService) {}

  @Get('person')
  @ApiOperation({
    summary: 'Buscar persona por CI',
    description:
      'Consulta la API de Strapi y devuelve los datos básicos de una persona filtrando por CI.',
  })
  @ApiQuery({
    name: 'ci',
    type: String,
    required: true,
    example: '11223344',
    description: 'Número de Cédula de Identidad de la persona',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos de la persona encontrados exitosamente',
    type: PersonResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontró una persona con el CI proporcionado',
  })
  async getPerson(@Query('ci') ci: string): Promise<PersonResponseDto> {
    return this.externalService.getPersonByCI(ci);
  }
}
