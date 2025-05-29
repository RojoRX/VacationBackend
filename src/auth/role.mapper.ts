// src/role.mapper.ts

export const mapRole = (role: string): string => {
  switch (role?.toUpperCase()) {
    case 'ADMIN':
      return 'admin'
    case 'SUPERVISOR':
      return 'supervisor'
    case 'USER':
      return 'client'
    default:
      return 'client' // fallback
  }
}
