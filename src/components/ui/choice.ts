export interface ChoiceOption<V extends string = string> {
  value: V;
  label: string;
  // Reclamo junto al nombre («2 meses gratis»).
  badge?: string;
  // Icono de Font Awesome delante del nombre (registrado en icons.ts).
  icon?: string;
  // Cuántos hay con esa opción (un filtro): va detrás del nombre, más tenue.
  count?: number;
  // No se puede elegir (un filtro que no enseñaría a nadie); title dice por qué.
  disabled?: boolean;
  // Lo que explica la opción al pasar por encima, o por qué no se puede elegir.
  title?: string;
}
