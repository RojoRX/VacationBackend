import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VacationRequest } from 'src/entities/vacation_request.entity';
import { UserService } from 'src/services/user.service';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { DateTime } from 'luxon';

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
  ): Promise<Omit<VacationRequest, 'user'>> {
    const user = await this.userService.findByCarnet(ci);

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Verificar si las fechas se solapan con otras solicitudes del mismo usuario
    await this.ensureNoOverlappingVacations(user.id, startDate, endDate);

    const daysOfVacation = await this.calculateVacationDays(startDate, endDate);
    const returnDate = await this.calculateReturnDate(startDate, daysOfVacation);

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

    // Retornar la solicitud sin los datos sensibles del usuario
    const { user: _user, ...requestWithoutSensitiveData } = savedRequest;
    return requestWithoutSensitiveData;
  }

  // Método para verificar solapamiento de vacaciones
  private async ensureNoOverlappingVacations(
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    const overlappingRequests = await this.vacationRequestRepository.find({
      where: [
        {
          user: { id: userId },
          startDate: DateTime.fromISO(startDate).toISODate(),
        },
        {
          user: { id: userId },
          endDate: DateTime.fromISO(endDate).toISODate(),
        },
      ],
    });

    if (overlappingRequests.length > 0) {
      throw new HttpException(
        'Vacation request overlaps with existing requests',
        HttpStatus.CONFLICT,
      );
    }
  }

  // Método para calcular los días de vacaciones, considerando solo días hábiles y excluyendo feriados
  private async calculateVacationDays(startDate: string, endDate: string): Promise<number> {
    const start = DateTime.fromISO(startDate);
    const end = DateTime.fromISO(endDate);

    if (end < start) {
      throw new HttpException('End date must be after start date', HttpStatus.BAD_REQUEST);
    }

    let totalDays = 0;
    const year = start.year;
    const nonHolidays = await this.nonHolidayService.getNonHolidayDays(year);

    for (let day = start; day <= end; day = day.plus({ days: 1 })) {
      const isWeekend = day.weekday === 6 || day.weekday === 7; // Sábado o domingo
      const isNonHoliday = nonHolidays.some((nonHoliday) => nonHoliday.date === day.toISODate());

      if (!isWeekend && !isNonHoliday) {
        totalDays++;
      }
    }

    return totalDays;
  }

  // Método para calcular la fecha de retorno asegurando que sea un día hábil
  private async calculateReturnDate(startDate: string, vacationDays: number): Promise<string> {
    let day = DateTime.fromISO(startDate).plus({ days: vacationDays });
    const year = day.year;
    const nonHolidays = await this.nonHolidayService.getNonHolidayDays(year);

    while (
      day.weekday === 6 ||
      day.weekday === 7 ||
      nonHolidays.some((nonHoliday) => nonHoliday.date === day.toISODate())
    ) {
      day = day.plus({ days: 1 });
    }

    return day.toISODate();
  }

  // Método para obtener todas las solicitudes de vacaciones de un usuario
  async getUserVacationRequests(userId: number): Promise<Omit<VacationRequest, 'user'>[]> {
    const requests = await this.vacationRequestRepository.find({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    return requests.map(({ user: _user, ...requestWithoutSensitiveData }) => requestWithoutSensitiveData);
  }

  // Método para obtener todas las vacaciones registradas
  async getAllVacationRequests(): Promise<Omit<VacationRequest, 'user'>[]> {
    const requests = await this.vacationRequestRepository.find({
      relations: ['user'],
    });

    return requests.map(({ user: _user, ...requestWithoutSensitiveData }) => requestWithoutSensitiveData);
  }
}
