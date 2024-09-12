// src/controllers/vacation-request.controller.ts
import { Controller, Post, Get, Query, Body, Param, HttpException, HttpStatus, Put } from '@nestjs/common';
import { VacationRequestService } from 'src/services/vacation_request.service';
import { CreateVacationRequestDto } from 'src/dto/create-vacation-request.dto';
import { UpdateVacationRequestStatusDto } from 'src/dto/update-vacation-request-status.dto';

@Controller('vacation-requests')
export class VacationRequestController {
  constructor(private readonly vacationRequestService: VacationRequestService) {}

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
    const { totalAuthorizedDays, requests } = await this.vacationRequestService.countAuthorizedVacationDaysInRange(
      ci,
      startDate,
      endDate,
    );
    // Cambia "totalDays" a "totalAuthorizedDays"
    return { totalAuthorizedDays, requests };
  } catch (error) {
    throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
  }
}


  // Endpoint para actualizar el estado de una solicitud de vacaciones
  @Put('status')
  async updateVacationRequestStatus(@Body() updateVacationRequestStatusDto: UpdateVacationRequestStatusDto) {
    const { id, status } = updateVacationRequestStatusDto;

    try {
      const updatedRequest = await this.vacationRequestService.updateVacationRequestStatus(id, status);
      return updatedRequest;
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
