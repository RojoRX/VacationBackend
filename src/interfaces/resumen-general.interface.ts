export default interface ResumenGeneral {
  deudaTotal: number;
  diasDisponiblesActuales: number;
  gestionesConDeuda: number;
  gestionesSinDeuda: number;
  promedioDeudaPorGestion: number;
  primeraGestion: Date | null;
  ultimaGestion: Date | null;

  // NUEVOS CAMPOS
  gestionesValidas: number;
  gestionesInvalidas: number;
}
