import { User } from "src/entities/user.entity";

// soft-delete-user.dto.ts
export class SoftDeleteUserDto {
  id: number;
  ci: string;
  fullName?: string;
  deleted: boolean;
  physicallyDeleted?: boolean;
  message: string;
}
