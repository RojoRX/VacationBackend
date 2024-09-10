// src/utils/vacation-request-utils.ts
import { DateTime } from 'luxon';
import { VacationRequest } from 'src/entities/vacation_request.entity';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

// Calcular los días de vacaciones, considerando solo días hábiles y excluyendo feriados
export async function calculateVacationDays(
    startDate: string,
    endDate: string,
    nonHolidayService: NonHolidayService
): Promise<number> {
    const start = DateTime.fromISO(startDate);
    const end = DateTime.fromISO(endDate);

    if (end < start) {
        throw new Error('End date must be after start date');
    }

    let totalDays = 0;
    const year = start.year;
    const nonHolidays = await nonHolidayService.getNonHolidayDays(year);

    for (let day = start; day <= end; day = day.plus({ days: 1 })) {
        const isWeekend = day.weekday === 6 || day.weekday === 7; // Sábado o domingo
        const isNonHoliday = nonHolidays.some((nonHoliday) => nonHoliday.date === day.toISODate());

        if (!isWeekend && !isNonHoliday) {
            totalDays++;
        }
    }

    return totalDays;
}

// Calcular la fecha de retorno asegurando que sea un día hábil
export async function calculateReturnDate(
    startDate: string,
    vacationDays: number,
    nonHolidayService: NonHolidayService
): Promise<string> {
    let day = DateTime.fromISO(startDate).plus({ days: vacationDays });
    const year = day.year;
    const nonHolidays = await nonHolidayService.getNonHolidayDays(year);

    while (
        day.weekday === 6 ||
        day.weekday === 7 ||
        nonHolidays.some((nonHoliday) => nonHoliday.date === day.toISODate())
    ) {
        day = day.plus({ days: 1 });
    }

    return day.toISODate();
}

// Verificar solapamiento de vacaciones
export async function ensureNoOverlappingVacations(
    vacationRequestRepository: any,
    userId: number,
    startDate: string,
    endDate: string
): Promise<void> {
    const overlappingRequests = await vacationRequestRepository.find({
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
        throw new Error('Vacation request overlaps with existing requests');
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
    repository: Repository<VacationRequest>,
    userId: number,
    startDate: string,
    endDate: string,
): Promise<{ requests: any[]; totalDays: number }> {
    // Verificar que startDate y endDate no sean nulos o vacíos
    if (!startDate || !endDate) {
        console.log('Start date or end date is missing.');
        return { requests: [], totalDays: 0 };
    }

    const start = DateTime.fromISO(startDate);
    const end = DateTime.fromISO(endDate);

    // Verificar si las fechas son válidas
    if (!start.isValid || !end.isValid) {
        console.log('Invalid date(s) provided');
        console.log('Received Start Date:', startDate);
        console.log('Received End Date:', endDate);
        console.log('Parsed Start Date:', start.toISO(), 'Is Valid:', start.isValid);
        console.log('Parsed End Date:', end.toISO(), 'Is Valid:', end.isValid);
        return { requests: [], totalDays: 0 };
    }

    console.log('Parsed Start Date:', start.toISO());
    console.log('Parsed End Date:', end.toISO());

    // Buscar solicitudes de vacaciones autorizadas dentro del rango
    const requests = await repository.find({
        where: {
            user: { id: userId },
            status: 'AUTHORIZED',
            startDate: LessThanOrEqual(end.toISODate()),
            endDate: MoreThanOrEqual(start.toISODate()),
        },
    });

    // Calcular los días efectivos
    const requestsWithTotalDays = requests.map((request) => {
        const requestStart = DateTime.fromISO(request.startDate);
        const requestEnd = DateTime.fromISO(request.endDate);

        // Determinar el rango efectivo
        const effectiveStart = requestStart > start ? requestStart : start;
        const effectiveEnd = requestEnd < end ? requestEnd : end;

        // Calcular los días efectivos
        const days = effectiveEnd.diff(effectiveStart, 'days').days + 1;

        console.log(`Request ID: ${request.id}, Effective Start: ${effectiveStart.toISODate()}, Effective End: ${effectiveEnd.toISODate()}, Days: ${days}`);

        return {
            ...request,
            totalDays: days,
        };
    });

    const totalDays = requestsWithTotalDays.reduce((acc, request) => acc + request.totalDays, 0);

    console.log('Requests with Total Days:', requestsWithTotalDays);
    console.log('Total Days:', totalDays);

    return { requests: requestsWithTotalDays, totalDays };
}
