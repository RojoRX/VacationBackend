// src/services/vacation_request.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VacationRequest } from 'src/entities/vacation_request.entity';
import { UserService } from 'src/services/user.service';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { calculateVacationDays, calculateReturnDate, ensureNoOverlappingVacations, countAuthorizedVacationDaysInRange, getAuthorizedVacationRequestsInRange } from 'src/utils/vacation-request-utils';

@Injectable()
export class VacationRequestService {
  constructor(
    @InjectRepository(VacationRequest)
    private readonly vacationRequestRepository: Repository<VacationRequest>,
    private readonly userService: UserService,
    private readonly nonHolidayService: NonHolidayService,
  ) {}

  // Método para crear una solicitud de vacaciones
  async createVacationRequest(
    ci: string,
    startDate: string,
    endDate: string,
    position: string,
  ): Promise<Omit<VacationRequest, 'user'> & { ci: string }> {
    const user = await this.userService.findByCarnet(ci);

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Verificar si las fechas se solapan con otras solicitudes del mismo usuario
    await ensureNoOverlappingVacations(this.vacationRequestRepository, user.id, startDate, endDate);

    const daysOfVacation = await calculateVacationDays(startDate, endDate, this.nonHolidayService);
    const returnDate = await calculateReturnDate(startDate, daysOfVacation, this.nonHolidayService);

    // Crear y guardar la solicitud de vacaciones
    const vacationRequest = this.vacationRequestRepository.create({
      user,
      position,
      requestDate: new Date().toISOString().split('T')[0],
      startDate: new Date(startDate).toISOString().split('T')[0],
      endDate: new Date(endDate).toISOString().split('T')[0],
      totalDays: daysOfVacation,
      status: 'PENDING', // Estado inicial ajustado a 'PENDING'
      returnDate: new Date(returnDate).toISOString().split('T')[0],
    });

    const savedRequest = await this.vacationRequestRepository.save(vacationRequest);

    // Retornar la solicitud sin los datos sensibles del usuario, pero incluyendo el CI
    const { user: _user, ...requestWithoutSensitiveData } = savedRequest;
    return { ...requestWithoutSensitiveData, ci: user.ci }; // Ajuste al usar user.ci
  }

  // Método para obtener todas las solicitudes de vacaciones de un usuario
  async getUserVacationRequests(userId: number): Promise<(Omit<VacationRequest, 'user'> & { ci: string })[]> {
    const requests = await this.vacationRequestRepository.find({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    return requests.map((request) => {
      const { user, ...requestWithoutSensitiveData } = request;
      return { ...requestWithoutSensitiveData, ci: user.ci };
    });
  }

  // Método para obtener todas las solicitudes de vacaciones
  async getAllVacationRequests(): Promise<(Omit<VacationRequest, 'user'> & { ci: string })[]> {
    const requests = await this.vacationRequestRepository.find({ relations: ['user'] });

    return requests.map((request) => {
      const { user, ...requestWithoutSensitiveData } = request;
      return { ...requestWithoutSensitiveData, ci: user.ci };
    });
  }

  // Método para contar los días de vacaciones autorizados en un rango de fechas
// src/services/vacation_request.service.ts

// Método para contar los días de vacaciones autorizados en un rango de fechas
async countAuthorizedVacationDaysInRange(
  ci: string,
  startDate: string,
  endDate: string,
): Promise<{ requests: any[]; totalAuthorizedDays: number }> {
  const user = await this.userService.findByCarnet(ci);

  if (!user) {
    throw new HttpException('User not found', HttpStatus.NOT_FOUND);
  }

  // Utiliza la función ajustada para obtener solicitudes y total de días autorizados
  const authorizedVacationDays = await getAuthorizedVacationRequestsInRange(
    this.vacationRequestRepository, 
    user.id, 
    startDate, 
    endDate
  );

  return authorizedVacationDays;
}


  // Método para actualizar el estado de una solicitud de vacaciones
  async updateVacationRequestStatus(id: number, status: string): Promise<VacationRequest> {
    const request = await this.vacationRequestRepository.findOne({
      where: { id },
    });

    if (!request) {
      throw new HttpException('Vacation request not found', HttpStatus.NOT_FOUND);
    }

    request.status = status;
    return await this.vacationRequestRepository.save(request);
  }
}
