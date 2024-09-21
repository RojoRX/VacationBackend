// src/controllers/vacation-request.controller.ts
import { Controller, Post, Get, Query, Body, Param, HttpException, HttpStatus, Put, Patch } from '@nestjs/common';
import { VacationRequestService } from 'src/services/vacation_request.service';
import { CreateVacationRequestDto } from 'src/dto/create-vacation-request.dto';
import { UpdateVacationRequestStatusDto } from 'src/dto/update-vacation-request-status.dto';
import { VacationRequest } from 'src/entities/vacation_request.entity';
import { VacationRequestDTO } from 'src/dto/vacation-request.dto';

@Controller('vacation-requests')
export class VacationRequestController {
  constructor(private readonly vacationRequestService: VacationRequestService) { }

  // Endpoint para crear una solicitud de vacaciones
  @Post()
  async createVacationRequest(@Body() createVacationRequestDto: CreateVacationRequestDto) {
    const { ci, startDate, endDate, position } = createVacationRequestDto;

    try {
      const vacationRequest = await this.vacationRequestService.createVacationRequest(
        ci,
        startDate,
        endDate,
        position,
      );
      return vacationRequest;
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Endpoint para obtener todas las solicitudes de vacaciones de un usuario
  @Get('user/:userId')
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
  async getAllVacationRequests() {
    try {
      const requests = await this.vacationRequestService.getAllVacationRequests();
      return requests;
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Endpoint para contar los días de vacaciones autorizados en un rango de fechas
  // Endpoint para contar los días de vacaciones autorizados en un rango de fechas
  @Get('authorized-days')
  async countAuthorizedVacationDays(
    @Query('ci') ci: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    try {
      // Llamar al servicio con el nombre actualizado de la variable
      const { totalAuthorizedVacationDays, requests } = await this.vacationRequestService.countAuthorizedVacationDaysInRange(
        ci,
        startDate,
        endDate,
      );

      // Retornar la respuesta con el nuevo nombre de la variable
      return { totalAuthorizedVacationDays, requests };
    } catch (error) {
      // Manejar errores de forma apropiada
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }



// Endpoint para actualizar el estado de una solicitud de vacaciones
@Patch(':vacationRequestId/approve')
async approveVacationRequest(
  @Param('vacationRequestId') vacationRequestId: number,
  @Query('supervisorId') supervisorId: number,
  @Body() body: { status: string }, // Mantener aquí
): Promise<VacationRequestDTO> { // Cambiar aquí
  return this.vacationRequestService.updateVacationRequestStatus(vacationRequestId, body.status, supervisorId);
}


  @Get('supervisor/:supervisorId')
  async getVacationRequestsBySupervisor(@Param('supervisorId') supervisorId: number): Promise<VacationRequestDTO[]> {
    return this.vacationRequestService.getVacationRequestsBySupervisor(supervisorId);
  }
  

}
