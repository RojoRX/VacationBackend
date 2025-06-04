// src/utils/vacation-request-utils.ts
import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { VacationRequest } from 'src/entities/vacation_request.entity';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { LessThanOrEqual, MoreThanOrEqual, Not, Repository } from 'typeorm';

// Calcular los días de vacaciones, considerando solo días hábiles y excluyendo feriados
export async function calculateVacationDays(
    startDate: string,
    endDate: string,
    nonHolidayService: NonHolidayService
): Promise<number> {
    // Asegurar que las fechas sean tratadas como UTC y al inicio del día
    const start = DateTime.fromISO(startDate, { zone: 'utc' }).startOf('day');
    const end = DateTime.fromISO(endDate, { zone: 'utc' }).startOf('day');

    console.log(`Start Date: ${start.toISODate()} | End Date: ${end.toISODate()}`);

    if (end < start) {
        throw new Error('End date must be after start date');
    }

    let totalDays = 0;
    const year = start.year;
    const nonHolidays = await nonHolidayService.getNonHolidayDays(year);

    // Iterar día por día (incluyendo el último día)
    for (let day = start; day <= end; day = day.plus({ days: 1 })) {
        const isWeekend = day.weekday === 6 || day.weekday === 7; // 6 = sábado, 7 = domingo
        const isNonHoliday = nonHolidays.some(nh => 
            DateTime.fromISO(nh.date).toISODate() === day.toISODate()
        );

        console.log(`Checking: ${day.toISODate()} | Weekend: ${isWeekend} | Non-Holiday: ${isNonHoliday}`);

        if (!isWeekend && !isNonHoliday) {
            totalDays++;
        }
    }

    console.log(`Total Vacation Days: ${totalDays}`);
    return totalDays;
}

// Calcular la fecha de retorno asegurando que sea un día hábil
export async function calculateReturnDate(
    endDate: string,
    vacationDays: number,
    nonHolidayService: NonHolidayService
): Promise<string> {
    // Comenzar desde el día siguiente al endDate
    let day = DateTime.fromISO(endDate).plus({ days: 1 });
    const year = day.year;
    const nonHolidays = await nonHolidayService.getNonHolidayDays(year);

    // Continuar buscando hasta encontrar un día hábil
    while (true) {
        // Verificar si el día no es sábado (6) ni domingo (7) y no es un día no hábil
        if (day.weekday !== 6 && day.weekday !== 7 && 
            !nonHolidays.some((nonHoliday) => nonHoliday.date === day.toISODate())) {
            return day.toISODate(); // Retornar la primera fecha hábil encontrada
        }
        day = day.plus({ days: 1 }); // Avanzar al siguiente día
    }
}

// Verificar solapamiento de vacaciones
export async function ensureNoOverlappingVacations(
  vacationRequestRepository: any,
  userId: number,
  startDate: string,
  endDate: string,
  excludeRequestId?: number
): Promise<void> {
  const where: any = [
    {
      user: { id: userId },
      status: 'AUTHORIZED',
      approvedByHR: true,
      approvedBySupervisor: true,
      startDate: LessThanOrEqual(endDate),
      endDate: MoreThanOrEqual(startDate),
    },
    {
      user: { id: userId },
      status: 'PENDING',
      startDate: LessThanOrEqual(endDate),
      endDate: MoreThanOrEqual(startDate),
    },
    {
      user: { id: userId },
      status: 'SUSPENDED',
      startDate: LessThanOrEqual(endDate),
      endDate: MoreThanOrEqual(startDate),
    },
  ];

  if (excludeRequestId) {
    where.forEach((condition) => {
      condition.id = Not(excludeRequestId);
    });
  }

  const overlappingRequests = await vacationRequestRepository.find({ where });

  if (overlappingRequests.length > 0) {
    throw new BadRequestException(
      'La solicitud se solapa con otra vacación activa (pendiente, suspendida o autorizada).'
    );
  }
}

// Contar los días de vacaciones autorizados en un rango de fechas
export async function countAuthorizedVacationDaysInRange(
    vacationRequestRepository: any,
    userId: number,
    startDate: string,
    endDate: string
): Promise<number> {
    const start = DateTime.fromISO(startDate).startOf('day');
    const end = DateTime.fromISO(endDate).endOf('day');

    const authorizedRequests = await vacationRequestRepository.find({
        where: {
            user: { id: userId },
            status: 'AUTHORIZED',
            startDate: LessThanOrEqual(end.toISODate()), // Solicitudes que terminan antes o en la fecha final
            endDate: MoreThanOrEqual(start.toISODate()), // Solicitudes que comienzan después o en la fecha inicial
        },
    });

    // Sumar los días totales de todas las solicitudes autorizadas
    const totalDays = authorizedRequests.reduce(
        (acc, request) => {
            const requestStart = DateTime.fromISO(request.startDate);
            const requestEnd = DateTime.fromISO(request.endDate);

            // Calcular los días de la solicitud dentro del rango de fechas
            const effectiveStart = requestStart > start ? requestStart : start;
            const effectiveEnd = requestEnd < end ? requestEnd : end;

            if (effectiveStart <= effectiveEnd) {
                const days = effectiveEnd.diff(effectiveStart, 'days').days + 1; // +1 para incluir el último día
                return acc + days;
            }

            return acc;
        },
        0,
    );

    return totalDays;
}

// Función para obtener las solicitudes autorizadas en un rango de fechas y contar los días
export async function getAuthorizedVacationRequestsInRange(
    vacationRequestRepository: Repository<VacationRequest>, 
    userId: number, 
    startDate: string, 
    endDate: string
  ): Promise<{ requests: VacationRequest[]; totalAuthorizedDays: number }> {
  
    // Consulta a la base de datos para obtener las solicitudes autorizadas
    const requests = await vacationRequestRepository.createQueryBuilder('request')
      .where('request.user.id = :userId', { userId })
      .andWhere('request.startDate >= :startDate', { startDate })
      .andWhere('request.endDate <= :endDate', { endDate })
      .andWhere('request.status = :status', { status: 'AUTHORIZED' })
      .getMany();
  
    // Calcular el total de días autorizados
    const totalAuthorizedDays = requests.reduce((total, request) => total + request.totalDays, 0);
  
    return {
      requests,
      totalAuthorizedDays,
    };
  }

  // Método auxiliar para validar gestiones anteriores con días disponibles
export function validateVacationRequest(
    detalles: any[],  // Array de gestiones (vacation details)
    startPeriod: string,
    endPeriod: string
): void {
    const requestedStartDate = DateTime.fromISO(startPeriod, { zone: 'utc' }).startOf('day');
  
    const hayGestionesAnterioresConDiasDisponibles = detalles.some((gestion) => {
        const gestionStartDate = DateTime.fromISO(gestion.startDate, { zone: 'utc' }).startOf('day');
        return gestionStartDate < requestedStartDate && gestion.diasDisponibles > 0;
    });
  
    if (hayGestionesAnterioresConDiasDisponibles) {
        throw new Error(
            'No se puede crear la solicitud de vacaciones: existen gestiones anteriores con días disponibles.'
        );
    }
}

// startDate: string en formato ISO, dias: número de días hábiles a contar
export async function getFechaFinPorDiasHabilesSoloLaborables(startDate: string, dias: number): Promise<Date> {
    let fecha = new Date(startDate);
    let count = 0;
  
    while (count < dias) {
      fecha.setDate(fecha.getDate() + 1);
      if (esDiaLaborable(fecha)) {
        count++;
      }
    }
  
    return fecha;
  }
  
  function esDiaLaborable(date: Date): boolean {
    const day = date.getDay();
    return day !== 0 && day !== 6; // domingo = 0, sábado = 6
    // Aquí también deberías excluir días no hábiles si tienes una lista
  }
  
  

