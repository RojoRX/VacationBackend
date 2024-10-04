import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { VacationRequest } from 'src/entities/vacation_request.entity';
import { UserService } from 'src/services/user.service';
import { NonHolidayService } from 'src/services/nonholiday.service';
import {
  calculateVacationDays,
  calculateReturnDate,
  ensureNoOverlappingVacations,
  countAuthorizedVacationDaysInRange,
  getAuthorizedVacationRequestsInRange,
} from 'src/utils/vacation-request-utils';
import { VacationRequestDTO } from 'src/dto/vacation-request.dto';

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
  managementPeriod: { startYear: number; endYear: number },
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
    user,  // Se asigna el usuario correctamente
    position,
    requestDate: new Date().toISOString().split('T')[0],
    startDate: new Date(startDate).toISOString().split('T')[0],
    endDate: new Date(endDate).toISOString().split('T')[0],
    totalDays: daysOfVacation,
    status: 'PENDING', // Estado inicial ajustado a 'PENDING'
    returnDate: new Date(returnDate).toISOString().split('T')[0],
    managementPeriod: {  // Usar el objeto managementPeriod
      startYear: managementPeriod.startYear,
      endYear: managementPeriod.endYear
    },
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

  async countAuthorizedVacationDaysInRange(
    ci: string,
    startDate: string,
    endDate: string,
  ): Promise<{ requests: VacationRequest[]; totalAuthorizedVacationDays: number }> {
    // Validar las fechas
    if (new Date(startDate) > new Date(endDate)) {
      throw new HttpException('Invalid date range', HttpStatus.BAD_REQUEST);
    }
  
    // Buscar usuario por carnet de identidad
    const user = await this.userService.findByCarnet(ci);

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
  
    // Extraer los años de las fechas
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
  
    // Obtener las solicitudes autorizadas que coincidan con los años del período de gestión
    const authorizedVacationDays = await this.vacationRequestRepository.find({
      where: {
        user: { id: user.id },
        status: 'AUTHORIZED',
        managementPeriod: {
          startYear: startYear, // Debe coincidir con el startYear del managementPeriod
          endYear: endYear,     // Debe coincidir con el endYear del managementPeriod
        },
      },
    });

    // Verificar que authorizedVacationDays no sea nulo o vacío
    if (!authorizedVacationDays || !Array.isArray(authorizedVacationDays)) {
      throw new HttpException('Failed to fetch authorized vacation days', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  
    // Calcular total de días autorizados
    const totalAuthorizedDays = authorizedVacationDays.reduce((total, request) => total + request.totalDays, 0);
  
    return {
      requests: authorizedVacationDays,
      totalAuthorizedVacationDays: totalAuthorizedDays,
    };
  }
  


  // Método para actualizar el estado de la solicitud de vacaciones
  async updateVacationRequestStatus(
    id: number,
    status: string,
    supervisorId: number,
  ): Promise<VacationRequestDTO> {
    const request = await this.vacationRequestRepository.findOne({
      where: { id },
      relations: ['user', 'user.department'], // Asegúrate de incluir la relación con el departamento
    });

    if (!request) {
      throw new HttpException('Vacation request not found', HttpStatus.NOT_FOUND);
    }

    // Verificar que el supervisor tenga permiso para actualizar solicitudes de su departamento
    const supervisor = await this.userService.findById(supervisorId);
    if (!supervisor || supervisor.department.id !== request.user.department.id) {
      throw new HttpException('Unauthorized to approve requests outside your department', HttpStatus.UNAUTHORIZED);
    }

    // Verificar que el estado enviado sea un valor válido del enum
    const validStatuses = ['PENDING', 'AUTHORIZED', 'POSTPONED', 'DENIED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      throw new HttpException('Invalid status provided', HttpStatus.BAD_REQUEST);
    }

    // Actualizar el estado y el valor de approvedBySupervisor
    request.status = status;
    request.approvedBySupervisor = true; // Siempre se marca como aprobado por el supervisor al actualizar el estado

    // Guardar la solicitud
    await this.vacationRequestRepository.save(request);

    // Mapear a DTO
    const vacationRequestDTO: VacationRequestDTO = {
      id: request.id,
      position: request.position,
      requestDate: request.requestDate,
      startDate: request.startDate,
      endDate: request.endDate,
      totalDays: request.totalDays,
      status: request.status,
      returnDate: request.returnDate,
      postponedDate: request.postponedDate,
      postponedReason: request.postponedReason,
      approvedByHR: request.approvedByHR,
      approvedBySupervisor: request.approvedBySupervisor,
      user: {
        id: request.user.id,
        ci: request.user.ci,
        fecha_ingreso: request.user.fecha_ingreso,
        username: request.user.username,
        // No incluimos el password ni otros datos sensibles
      },
    };

    return vacationRequestDTO;
  }

  // Método para obtener todas las solicitudes de vacaciones de un departamento según el supervisor
  async getVacationRequestsBySupervisor(supervisorId: number): Promise<VacationRequestDTO[]> {
    const supervisor = await this.userService.findById(supervisorId);
    if (!supervisor) {
      throw new HttpException('Supervisor not found', HttpStatus.NOT_FOUND);
    }

    const departmentId = supervisor.department.id;
    if (!departmentId) {
      throw new HttpException('Supervisor does not belong to any department', HttpStatus.BAD_REQUEST);
    }

    const requests = await this.vacationRequestRepository.find({
      where: { user: { department: { id: departmentId } } },
      relations: ['user'],
    });

    if (requests.length === 0) {
      throw new HttpException('No vacation requests found for this department', HttpStatus.NOT_FOUND);
    }

    // Mapeo de las solicitudes a DTO
    return requests.map(request => {
      const { user, ...rest } = request;
      return {
        ...rest,
        user: {
          id: user.id,
          ci: user.ci,
          fecha_ingreso: user.fecha_ingreso,
          username: user.username,
        },
      } as VacationRequestDTO;
    });
  }

  
}
