// userholidayperiod.dto.ts

import { HolidayPeriodName } from "src/entities/holydayperiod.entity";

export class UserHolidayPeriodDto {
    id: number;
    name: HolidayPeriodName;
    startDate: Date;
    endDate: Date;
    year: number;
  }
  // userholidayperiod.service.ts