import { Injectable, HttpException, HttpStatus, forwardRef, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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
  
    // Crear fechas asegurando que no haya desfase de zona horaria
    const startPeriodDate = new Date(Date.UTC(
      parseInt(managementPeriod.startPeriod.substring(0, 4)), // Año
      parseInt(managementPeriod.startPeriod.substring(5, 7)) - 1, // Mes (base 0)
      parseInt(managementPeriod.startPeriod.substring(8, 10)) // Día
    ));
  
    const endPeriodDate = new Date(Date.UTC(
      parseInt(managementPeriod.endPeriod.substring(0, 4)),
      parseInt(managementPeriod.endPeriod.substring(5, 7)) - 1,
      parseInt(managementPeriod.endPeriod.substring(8, 10))
    ));
  
    // Obtener la deuda acumulativa y los detalles de las gestiones
    const accumulatedDebtResponse = await this.vacationService.calculateAccumulatedDebt(ci, endPeriodDate);
    console.log(`Enviando el date de ${endPeriodDate.toISOString()}`);
  
    // Depuración: Mostrar la fecha de fin del período de gestión
    console.log(`[Depuración] Fecha de fin del período de gestión: ${endPeriodDate.toISOString()}`);
  
    // Depuración: Mostrar todas las gestiones y sus fechas
    console.log(`[Depuración] Detalles de las gestiones:`);
    accumulatedDebtResponse.detalles.forEach((gestion, index) => {
      console.log(`- Gestión ${index + 1}:`);
      console.log(`  - startDate: ${gestion.startDate}`);
      console.log(`  - endDate: ${gestion.endDate}`);
      console.log(`  - diasDisponibles: ${gestion.diasDisponibles}`);
    });
  
    // Encontrar la gestión correspondiente a la fecha de fin del período de gestión
    const gestionCorrespondiente = accumulatedDebtResponse.detalles.find(
      (gestion) => {
        const gestionEndDate = new Date(gestion.endDate);
        
        // Normalizar fechas a timestamps numéricos antes de comparar
        const gestionEndTime = gestionEndDate.getTime();
        const endPeriodTime = endPeriodDate.getTime();
  
        // Depuración: Mostrar las fechas de la gestión actual y la comparación
        console.log(`[Depuración] Comparando con gestión ${gestion.startDate} - ${gestion.endDate}`);
        console.log(`- endDate gestion: ${gestionEndDate.toISOString()}`);
        console.log(`- endPeriodDate: ${endPeriodDate.toISOString()}`);
        console.log(`- ¿endDate coincide con endPeriodDate? ${gestionEndTime === endPeriodTime}`);
  
        return gestionEndTime === endPeriodTime;
      }
    );
  
    if (!gestionCorrespondiente) {
      throw new HttpException(
        `No se encontró una gestión válida para la fecha de fin del período de gestión (${endPeriodDate.toISOString()}).`,
        HttpStatus.BAD_REQUEST
      );
    }
  
    // Verificar si hay días disponibles en la gestión correspondiente
    if (gestionCorrespondiente.diasDisponibles <= 0) {
      throw new HttpException(
        `No puedes solicitar vacaciones. No tienes días disponibles en la gestión seleccionada. Días disponibles: ${gestionCorrespondiente.diasDisponibles}`,
        HttpStatus.BAD_REQUEST
      );
    }
  
    // Convertir fechas de solicitud correctamente
    const startDateISO = new Date(startDate + "T00:00:00Z").toISOString();
    const endDateISO = new Date(endDate + "T23:59:59Z").toISOString();
  
    // Verificar si las fechas se solapan con otras solicitudes del mismo usuario
    await ensureNoOverlappingVacations(this.vacationRequestRepository, user.id, startDateISO, endDateISO);
  
    // Calcular los días solicitados para la solicitud de vacaciones
    const daysRequested = await calculateVacationDays(startDateISO, endDateISO, this.nonHolidayService);
  
    // Calcular la fecha de retorno y convertir a ISO string
    const returnDateISO = new Date(await calculateReturnDate(endDateISO, daysRequested, this.nonHolidayService)).toISOString();
  
    // Crear y guardar la solicitud de vacaciones con las fechas corregidas
    const vacationRequest = this.vacationRequestRepository.create({
      user,
      position,
      requestDate: new Date().toISOString(), // Fecha actual en formato ISO
      startDate: startDateISO, // Fecha de inicio en formato ISO
      endDate: endDateISO, // Fecha de fin en formato ISO
      totalDays: daysRequested,
      status: 'PENDING', // Estado inicial
      returnDate: returnDateISO, // Fecha de retorno en formato ISO
      managementPeriodStart: startPeriodDate.toISOString(), // Usar la fecha corregida en formato ISO
      managementPeriodEnd: endPeriodDate.toISOString(), // Usar la fecha corregida en formato ISO
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
      return { ...requestWithoutSensitiveData, ci: user.ci, username: user.username };
    });
  }


  async countAuthorizedVacationDaysInRange(
    ci: string,
    startDate: string,
    endDate: string
  ): Promise<{ requests: VacationRequest[]; totalAuthorizedVacationDays: number }> {
    // Validar que la fecha de inicio no sea mayor que la fecha de fin
    if (new Date(startDate) > new Date(endDate)) {
      throw new HttpException('Invalid date range', HttpStatus.BAD_REQUEST);
    }
  
    // Buscar usuario por carnet de identidad
    const user = await this.userService.findByCarnet(ci);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
  
    // Convertir fechas sin parte horaria para asegurar precisión en comparación
    const startDateWithoutTime = new Date(startDate).toISOString().split('T')[0];
    const endDateWithoutTime = new Date(endDate).toISOString().split('T')[0];
  
    // Obtener solicitudes autorizadas y aprobadas por Recursos Humanos en el rango de fechas
    const authorizedVacationDays = await this.vacationRequestRepository.find({
      where: {
        user: { id: user.id },
        status: 'AUTHORIZED',
        approvedByHR: true,
        managementPeriodStart: startDateWithoutTime, // Filtro exacto
        managementPeriodEnd: endDateWithoutTime,     // Filtro exacto
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
  // Método para actualizar el estado de la solicitud de vacaciones 
  async updateVacationRequestStatus(
    id: number,
    status: string,
    supervisorId: number, // Recibe el ID del supervisor
): Promise<VacationRequestDTO> {
    console.log("updateVacationRequestStatus - Received supervisorId:", supervisorId);

    const request: VacationRequest = await this.vacationRequestRepository.findOne({
        where: { id },
        relations: ['user', 'approvedBy', 'user.department'],
    });

    if (!request) {
        throw new HttpException('Vacation request not found', HttpStatus.NOT_FOUND);
    }

    console.log("updateVacationRequestStatus - Request user's department ID:", request.user.department.id);

    const supervisor = await this.userService.findById(supervisorId);

    console.log("updateVacationRequestStatus - Retrieved supervisor:", supervisor);

    if (!supervisor) {
        throw new HttpException('Supervisor not found', HttpStatus.NOT_FOUND);
    }

    console.log("updateVacationRequestStatus - Supervisor's department ID:", supervisor.department.id);

    if (supervisor.department.id !== request.user.department.id) {
        throw new HttpException('Unauthorized to approve requests outside your department', HttpStatus.UNAUTHORIZED);
    }

    const validStatuses = ['PENDING', 'AUTHORIZED', 'DENIED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
        throw new HttpException('Invalid status provided', HttpStatus.BAD_REQUEST);
    }

    request.status = status;
    request.approvedBySupervisor = true;

    const today = new Date();
    request.reviewDate = today.toLocaleDateString('en-CA'); // Formato YYYY-MM-DD

    await this.vacationRequestRepository.save(request);

    const vacationRequestDTO: VacationRequestDTO = {
        id: request.id,
        position: request.position,
        requestDate: request.requestDate,
        startDate: request.startDate,
        endDate: request.endDate,
        totalDays: request.totalDays,
        status: request.status,
        returnDate: request.returnDate,
        reviewDate: request.reviewDate,
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
        approvedBy: request.approvedBy ?? undefined,
    };

    return vacationRequestDTO;
}

  // Método para obtener todas las solicitudes de vacaciones de un departamento según el supervisor
  async getVacationRequestsBySupervisor(supervisorId: number): Promise<VacationRequestDTO[]> {
    // Buscar el supervisor por su ID
    const supervisor = await this.userService.findById(supervisorId);
    if (!supervisor) {
      throw new HttpException('Supervisor not found', HttpStatus.NOT_FOUND);
    }

    // Obtener el departmentId del supervisor
    const departmentId = supervisor.department.id;
    if (!departmentId) {
      throw new HttpException('Supervisor does not belong to any department', HttpStatus.BAD_REQUEST);
    }

    // Buscar todas las solicitudes de vacaciones de los usuarios en el mismo departamento que el supervisor
    const requests = await this.vacationRequestRepository.find({
      where: { user: { department: { id: departmentId } } },
      relations: ['user'],
    });

    // Si no hay solicitudes en el departamento, lanzar excepción
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
      reviewDate: request.reviewDate,
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

  async getVacationRequestDetails(id: number): Promise<any> {
    const request = await this.vacationRequestRepository.findOne({
      where: { id },
      relations: ['user', 'user.department'], // Asegúrate de que las relaciones estén correctamente configuradas
    });

    if (!request) {
      throw new HttpException('Vacation request not found', HttpStatus.NOT_FOUND);
    }

    if (!request.user) {
      throw new HttpException('User not found for this vacation request', HttpStatus.NOT_FOUND);
    }

    // Obtener los datos necesarios
    const ci = request.user.ci; // Asegúrate de que este campo esté disponible
    const managementPeriodStart = request.managementPeriodStart; // Cambiado
    const managementPeriodEnd = request.managementPeriodEnd; // Cambiado

    if (!managementPeriodStart || !managementPeriodEnd) {
      throw new HttpException('Management period not found for this request', HttpStatus.NOT_FOUND);
    }

    // Obtener los días restantes de vacaciones del empleado
    let vacationResponse;
    try {
      vacationResponse = await this.vacationService.calculateVacationDays(
        ci,
        new Date(managementPeriodStart),
        new Date(managementPeriodEnd)
      );
    } catch (error) {
      console.error('Error al calcular los días de vacaciones:', error);
      throw new HttpException('Error al calcular los días de vacaciones', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Construir la respuesta con la información deseada
    return {
      requestId: request.id,
      userName: request.user.fullName,
      ci:request.user.ci,
      position: request.user.position,
      requestDate: request.requestDate,
      department: request.user.department ? request.user.department.name : null,
      startDate: request.startDate,
      endDate: request.endDate,
      reviewDate: request.reviewDate,
      totalDays: request.totalDays,
      status: request.status,
      returnDate: request.returnDate,
      postponedDate: request.postponedDate,
      postponedReason: request.postponedReason,
      approvedByHR: request.approvedByHR,
      approvedBySupervisor: request.approvedBySupervisor,
      managementPeriodStart: managementPeriodStart,
      managementPeriodEnd: managementPeriodEnd,
      // Agregar los datos calculados
      fechaIngreso: vacationResponse.fechaIngreso,
      antiguedadEnAnios: vacationResponse.antiguedadEnAnios,
      diasDeVacacion: vacationResponse.diasDeVacacion,
      diasDeVacacionRestantes: vacationResponse.diasDeVacacionRestantes,
      recesos: vacationResponse.recesos,
      licenciasAutorizadas: vacationResponse.licenciasAutorizadas,
      solicitudesDeVacacionAutorizadas: vacationResponse.solicitudesDeVacacionAutorizadas,
    };
  }

  // Actualizar el estado de una solicitud por el supervisor
  async updateStatus(id: number, newStatus: string): Promise<VacationRequest> {
    // Verifica si el nuevo estado es válido
    const validStatuses = ['PENDING', 'AUTHORIZED', 'POSTPONED', 'DENIED', 'SUSPENDED'];
    if (!validStatuses.includes(newStatus)) {
      throw new BadRequestException('Invalid status');
    }

    // Busca la entidad por ID
    const entity = await this.vacationRequestRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Entity not found');
    }
    // Actualiza el estado
    entity.status = newStatus;
    // Cambia approvedBySupervisor a true si aún no se ha hecho
    if (!entity.approvedBySupervisor) {
      entity.approvedBySupervisor = true;
    }
    // Actualiza la fecha de revisión con la fecha actual en formato 'YYYY-MM-DD'
    const today = new Date();
    entity.reviewDate = today.toISOString().split('T')[0];
    // Guarda los cambios en la base de datos
    return this.vacationRequestRepository.save(entity);
  }



  // async getAllVacationRequestsWithDepartment(): Promise<any[]> {
  //   const vacationRequests = await this.vacationRequestRepository
  //     .createQueryBuilder('vacationRequest')
  //     .leftJoinAndSelect('vacationRequest.user', 'user')
  //     .leftJoinAndSelect('user.department', 'department')
  //     .select([
  //       'vacationRequest',
  //       'user.ci',
  //       'department.id AS departmentId' // Selecciona el ID del departamento
  //     ])
  //     .orderBy('vacationRequest.requestDate', 'DESC')
  //     .getRawMany();

  //   return vacationRequests.map(request => ({
  //     ...request.vacationRequest, // Agrega todos los campos de la solicitud de vacaciones
  //     ci: request.ci,
  //     departmentId: request.departmentId, // Agrega el ID del departamento
  //   }));
  // }

  async toggleApprovedByHR(vacationRequestId: number): Promise<VacationRequest> {
    const vacationRequest = await this.vacationRequestRepository.findOne({
      where: { id: vacationRequestId }
    });

    if (!vacationRequest) {
      throw new Error('Solicitud de vacaciones no encontrada');
    }

    // Alterna el valor de approvedByHR
    vacationRequest.approvedByHR = !vacationRequest.approvedByHR;

    // Guarda los cambios
    await this.vacationRequestRepository.save(vacationRequest);

    return vacationRequest;
  }


  // Método para posponer una solicitud de vacaciones
  async postponeVacationRequest(
    id: number,
    postponedDate: string,
    postponedReason: string,
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

    // Verificar que el supervisor tenga permiso para posponer solicitudes de su departamento
    const supervisor = await this.userService.findById(supervisorId);
    if (!supervisor || supervisor.department.id !== request.user.department.id) {
      throw new HttpException('Unauthorized to postpone requests outside your department', HttpStatus.UNAUTHORIZED);
    }

    // Validar que la fecha de posposición no sea anterior a la fecha actual
    const currentDate = new Date().toISOString().split('T')[0];
    if (postponedDate < currentDate) {
      throw new HttpException('Postponed date cannot be in the past', HttpStatus.BAD_REQUEST);
    }

    // Actualizar los campos de posposición y el estado de la solicitud
    request.status = 'POSTPONED';
    request.postponedDate = postponedDate;
    request.postponedReason = postponedReason;
    request.approvedBySupervisor = true; // Indica que fue aprobado por el supervisor

    // Guardar los cambios en la base de datos
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
      reviewDate: request.reviewDate,
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
      } : undefined,
    };

    return vacationRequestDTO;
  }


}