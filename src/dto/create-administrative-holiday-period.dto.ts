import { AdministrativeHolidayName } from 'src/entities/administrativeHolidayPeriod.entity';

export class CreateAdministrativeHolidayPeriodDto {
  name: AdministrativeHolidayName;
  startDate: string;
  endDate: string;
}
