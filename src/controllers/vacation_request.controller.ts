import { Controller, Post, Get, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { VacationRequestService } from 'src/services/vacation_request.service';
import { CreateVacationRequestDto } from 'src/dto/create-vacation-request.dto';

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
}
