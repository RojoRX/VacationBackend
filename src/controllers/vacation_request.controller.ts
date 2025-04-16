import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Patch,
  Put,
} from '@nestjs/common';
import { VacationRequestService } from 'src/services/vacation_request.service';
import { CreateVacationRequestDto } from 'src/dto/create-vacation-request.dto';
import { VacationRequestDTO } from 'src/dto/vacation-request.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { UpdateStatusDto } from 'src/dto/updateStatus.dto';
import { PostponeVacationRequestDTO } from 'src/dto/postponed-vacation-request.dto';

@ApiTags('Solicitar Vacaciones')
@Controller('vacation-requests')
export class VacationRequestController {
  constructor(private readonly vacationRequestService: VacationRequestService) {}

  // Endpoint para crear una solicitud de vacaciones
  @Post()
  @ApiOperation({ summary: 'Crear una solicitud de vacaciones' })
  @ApiBody({ type: CreateVacationRequestDto })
  @ApiResponse({ status: 201, description: 'Solicitud de vacaciones creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Error al crear la solicitud de vacaciones' })
  async createVacationRequest(@Body() createVacationRequestDto: CreateVacationRequestDto) {
    const { ci, startDate, endDate, position, managementPeriodStart, managementPeriodEnd } = createVacationRequestDto;

    try {
      const vacationRequest = await this.vacationRequestService.createVacationRequest(
        ci,
        startDate,
        endDate,
        position,
        {
          startPeriod: managementPeriodStart, // Usamos managementPeriodStart
          endPeriod: managementPeriodEnd,     // Usamos managementPeriodEnd
        },
      );
      return vacationRequest;
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Endpoint para obtener todas las solicitudes de vacaciones de un usuario
  @Get('user/:userId')
  @ApiOperation({ summary: 'Obtener solicitudes de vacaciones por usuario' })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes de vacaciones del usuario' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async getUserVacationRequests(@Param('userId') userId: string) {
    try {
      const requests = await this.vacationRequestService.getUserVacationRequests(parseInt(userId, 10));
      return requests;
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Endpoint para obtener todas las vacaciones registradas
  @Get()
  @ApiOperation({ summary: 'Obtener todas las solicitudes de vacaciones' })
  @ApiResponse({ status: 200, description: 'Lista de todas las solicitudes de vacaciones' })
  async getAllVacationRequests() {
    try {
      const requests = await this.vacationRequestService.getAllVacationRequests();
      return requests;
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Endpoint para contar los días de vacaciones autorizados en un rango de fechas
  @Get('authorized-days')
  @ApiOperation({ summary: 'Contar días de vacaciones autorizados en un rango de fechas' })
  @ApiResponse({ status: 200, description: 'Total de días autorizados y solicitudes en el rango' })
  @ApiResponse({ status: 400, description: 'Error en la consulta' })
  async countAuthorizedVacationDays(
    @Query('ci') ci: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    // Validación de parámetros
    if (!ci || !startDate || !endDate) {
      throw new HttpException('Faltan parámetros obligatorios.', HttpStatus.BAD_REQUEST);
    }

    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    // Validación de fechas
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      throw new HttpException('Fechas inválidas.', HttpStatus.BAD_REQUEST);
    }

    if (startDateTime > endDateTime) {
      throw new HttpException('La fecha de inicio no puede ser mayor que la fecha de fin.', HttpStatus.BAD_REQUEST);
    }

    try {
      const { totalAuthorizedVacationDays, requests } = await this.vacationRequestService.countAuthorizedVacationDaysInRange(
        ci,
        startDate,
        endDate,
      );

      return { totalAuthorizedVacationDays, requests };
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Endpoint para actualizar el estado de una solicitud de vacaciones
  @Patch(':vacationRequestId/status')
  @ApiOperation({ summary: 'Actualizar estado de una solicitud de vacaciones por el supervisor' })
  @ApiResponse({ status: 200, description: 'Estado de la solicitud actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({ status: 400, description: 'Error al actualizar el estado' })
  async updateVacationRequestStatus(
    @Param('vacationRequestId') vacationRequestId: number,
    @Body() body: { status: string; supervisorId: number }, // Tipado correcto para el body
): Promise<VacationRequestDTO> {
    try {
        return await this.vacationRequestService.updateVacationRequestStatus(
            vacationRequestId,
            body.status,
            body.supervisorId, // Accede a supervisorId desde body
        );
    } catch (error) {
        throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
}

  // Endpoint para obtener solicitudes de vacaciones por supervisor
  @Get('supervisor/:supervisorId')
  @ApiOperation({ summary: 'Obtener solicitudes de vacaciones por supervisor' })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes de vacaciones del supervisor' })
  async getVacationRequestsBySupervisor(@Param('supervisorId') supervisorId: number): Promise<VacationRequestDTO[]> {
    return await this.vacationRequestService.getVacationRequestsBySupervisor(supervisorId);
  }

  // Endpoint para obtener una solicitud de vacaciones por ID
@Get(':id')
@ApiOperation({ summary: 'Obtener solicitud de vacaciones por ID' })
@ApiResponse({ status: 200, description: 'Solicitud de vacaciones encontrada' })
@ApiResponse({ status: 404, description: 'Solicitud de vacaciones no encontrada' })
async getVacationRequestById(@Param('id') id: number): Promise<VacationRequestDTO> {
  try {
    const vacationRequest = await this.vacationRequestService.getVacationRequestById(id);
    return vacationRequest;
  } catch (error) {
    throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

@Get(':id/details')
@ApiOperation({ summary: 'Obtener detalles de la solicitud de vacaciones por ID' })
@ApiResponse({ status: 200, description: 'Detalles de la solicitud de vacaciones encontrados' })
@ApiResponse({ status: 404, description: 'Solicitud de vacaciones no encontrada' })
async getVacationRequestDetails(@Param('id') id: number): Promise<any> {
  try {
    const vacationRequestDetails = await this.vacationRequestService.getVacationRequestDetails(id);
    return vacationRequestDetails; // Retorna directamente el objeto creado en el servicio
  } catch (error) {
    throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
  }
}


@Patch(':id/status')
@ApiOperation({ summary: 'Cambiar el estado de una Solicitud por el supervisor' })
@ApiResponse({ status: 200, description: 'Estado modificado con éxito' })
@ApiResponse({ status: 404, description: 'No se encontró la solicitud' })
@ApiResponse({ status: 400, description: 'Estado inválido' }) // Agregar esta respuesta
async updateStatus(@Param('id') id: number, @Body() updateStatusDto: UpdateStatusDto) {
  return this.vacationRequestService.updateStatus(id, updateStatusDto.status);
}

@Put(':id/toggle-approved-by-hr')
@ApiOperation({ summary: 'Alternar el estado de ApprovedByHR de una solicitud de vacaciones' })
@ApiResponse({ status: 200, description: 'Solicitud de vacaciones actualizada con éxito' })
async toggleApprovedByHR(
  @Param('id') id: number,
  @Body('hrUserId') hrUserId: number,
) {
  return this.vacationRequestService.toggleApprovedByHR(id, hrUserId);
}


// // Endpoint para obtener todas las solicitudes de vacaciones con el departamento y ordenadas por las más recientes
// @Get('department')
// @ApiOperation({ summary: 'Obtener todas las solicitudes de vacaciones con departamento' })
// @ApiResponse({ status: 200, description: 'Listado de solicitudes obtenidas con éxito' })
// async getAllVacationRequestsWithDepartment() {
//   return this.vacationRequestService.getAllVacationRequestsWithDepartment();
// }


@Patch(':id/postpone')
@ApiOperation({ summary: 'Postpone a vacation request', description: 'Allows a supervisor to postpone a vacation request by providing a new date and a reason.' })
@ApiParam({ name: 'id', description: 'The ID of the vacation request to be postponed', type: Number })
@ApiBody({ type: PostponeVacationRequestDTO, description: 'Details for postponing the vacation request, including postponed date and reason' })
@ApiResponse({
  status: 200,
  description: 'Vacation request successfully postponed.',
  type: VacationRequestDTO,
})
@ApiResponse({
  status: 400,
  description: 'Invalid postponed date or other validation errors.',
})
@ApiResponse({
  status: 404,
  description: 'Vacation request not found.',
})
@ApiResponse({
  status: 401,
  description: 'Unauthorized to postpone requests outside your department.',
})
async postponeVacationRequest(
  @Param('id') id: number,
  @Body() postponeData: PostponeVacationRequestDTO,
  @Param('supervisorId') supervisorId: number,
): Promise<VacationRequestDTO> {
  const { postponedDate, postponedReason } = postponeData;
  return this.vacationRequestService.postponeVacationRequest(id, postponedDate, postponedReason, supervisorId);
}
}

