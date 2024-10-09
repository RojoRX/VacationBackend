import { Injectable, HttpException, HttpStatus, forwardRef, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
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
import { VacationService } from './vacation.service';

@Injectable()
export class VacationRequestService {
  constructor(
    @InjectRepository(VacationRequest)
    private readonly vacationRequestRepository: Repository<VacationRequest>,
    private readonly userService: UserService,
    private readonly nonHolidayService: NonHolidayService,
    @Inject(forwardRef(() => VacationService))
    private readonly vacationService: VacationService,
  ) { }


  async createVacationRequest(
    ci: string,
    startDate: string,
    endDate: string,
    position: string,
    managementPeriod: { startPeriod: string; endPeriod: string },
  ): Promise<Omit<VacationRequest, 'user'> & { ci: string }> {

    // Buscar el usuario por CI
    const user = await this.userService.findByCarnet(ci);

    if (!user) {

      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }



    // Obtener los días restantes de vacaciones del empleado
    const vacationResponse = await this.vacationService.calculateVacationDays(ci, new Date(managementPeriod.startPeriod), new Date(managementPeriod.endPeriod));


    // Verificar si los días restantes son suficientes
    const daysRequested = await calculateVacationDays(startDate, endDate, this.nonHolidayService); // Días solicitados
    const remainingVacationDays = vacationResponse.diasDeVacacionRestantes;

    if (daysRequested > remainingVacationDays) {
      throw new HttpException(
        `No puedes solicitar más de ${remainingVacationDays} días de vacaciones. Has solicitado ${daysRequested} días.`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Verificar si las fechas se solapan con otras solicitudes del mismo usuario
    await ensureNoOverlappingVacations(this.vacationRequestRepository, user.id, startDate, endDate);
    // Calcular la fecha de retorno
    const returnDate = await calculateReturnDate(startDate, daysRequested, this.nonHolidayService);

    // Crear y guardar la solicitud de vacaciones
    const vacationRequest = this.vacationRequestRepository.create({
      user,  // Asignamos el usuario correctamente
      position,
      requestDate: new Date().toISOString().split('T')[0], // Fecha actual de solicitud en formato YYYY-MM-DD
      startDate: new Date(startDate).toISOString().split('T')[0], // Convertimos fecha de inicio
      endDate: new Date(endDate).toISOString().split('T')[0], // Convertimos fecha de fin
      totalDays: daysRequested,
      status: 'PENDING', // Estado inicial
      returnDate: new Date(returnDate).toISOString().split('T')[0], // Convertimos la fecha de retorno
      managementPeriodStart: managementPeriod.startPeriod, // Asignar startPeriod
      managementPeriodEnd: managementPeriod.endPeriod, // Asignar endPeriod
    });


    // Guardar la solicitud en la base de datos
    const savedRequest = await this.vacationRequestRepository.save(vacationRequest);

    // Retornar la solicitud sin los datos sensibles del usuario, pero incluyendo el CI
    const { user: _user, ...requestWithoutSensitiveData } = savedRequest;
    const response = { ...requestWithoutSensitiveData, ci: user.ci };


    return response;
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
    // Validate the dates
    if (new Date(startDate) > new Date(endDate)) {
      throw new HttpException('Invalid date range', HttpStatus.BAD_REQUEST);
    }

    // Buscar usuario por carnet de identidad
    const user = await this.userService.findByCarnet(ci);

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Get dates without timezones for comparison
    const startDateWithoutTime = new Date(startDate).toISOString().split('T')[0];
    const endDateWithoutTime = new Date(endDate).toISOString().split('T')[0];

    // Obtener las solicitudes autorizadas que coincidan con el rango de fechas proporcionado
    // Obtener las solicitudes autorizadas que coincidan con el rango de fechas proporcionado
    const authorizedVacationDays = await this.vacationRequestRepository.find({
      where: {
        user: { id: user.id },
        status: 'AUTHORIZED',
        managementPeriodStart: LessThanOrEqual(endDateWithoutTime),
        managementPeriodEnd: MoreThanOrEqual(startDateWithoutTime),
      },
    });

    // Verificar que authorizedVacationDays no sea nulo o vacío
    if (!authorizedVacationDays || !Array.isArray(authorizedVacationDays)) {
      throw new HttpException('Failed to fetch authorized vacation days', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Calcular el total de días autorizados
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
  // Buscar la solicitud de vacaciones por ID, incluyendo la relación con el usuario
  const request = await this.vacationRequestRepository.findOne({
    where: { id },
    relations: ['user', 'approvedBy', 'user.department'], // Incluir la relación con el aprobador y el departamento
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
    },
    managementPeriodStart: request.managementPeriodStart, // Agregar el período de gestión
    managementPeriodEnd: request.managementPeriodEnd,     // Agregar el período de gestión
    approvedBy: request.approvedBy ? {
      id: request.approvedBy.id,
      ci: request.approvedBy.ci,
      fecha_ingreso: request.approvedBy.fecha_ingreso,
      username: request.approvedBy.username,
    } : undefined, // Manejar caso en que no hay aprobador
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
  


// Método para obtener una solicitud de vacaciones por su ID
async getVacationRequestById(id: number): Promise<VacationRequestDTO> {
  // Buscar la solicitud de vacaciones por ID, incluyendo la relación con el usuario
  const request = await this.vacationRequestRepository.findOne({
    where: { id },
    relations: ['user', 'approvedBy'], // Incluir la relación con el usuario y con el aprobador
  });

  // Si la solicitud no se encuentra, lanzar una excepción
  if (!request) {
    throw new HttpException('Vacation request not found', HttpStatus.NOT_FOUND);
  }

  // Mapear los datos de la solicitud a un DTO
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
    },
    managementPeriodStart: request.managementPeriodStart,
    managementPeriodEnd: request.managementPeriodEnd,
    approvedBy: request.approvedBy ? {
      id: request.approvedBy.id,
      ci: request.approvedBy.ci,
      fecha_ingreso: request.approvedBy.fecha_ingreso,
      username: request.approvedBy.username,
    } : undefined, // Manejar caso en que no hay aprobador
  };

  return vacationRequestDTO;
}



}
