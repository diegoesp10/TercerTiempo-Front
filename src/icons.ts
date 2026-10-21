import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowRightArrowLeft,
  faArrowUpFromBracket,
  faCalendarCheck,
  faChartLine,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleInfo,
  faFutbol,
  faLocationDot,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faShieldHalved,
  faTrash,
  faTriangleExclamation,
  faUpRightFromSquare,
  faUserGroup,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

/**
 * Iconos de Font Awesome que usa la interfaz (solo los registrados aquí entran en el bundle).
 * Se usan como <Icon icon="chevron-down" />.
 */
library.add(
  faArrowRightArrowLeft,
  faArrowUpFromBracket,
  faCalendarCheck,
  faChartLine,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleInfo,
  faFutbol,
  faLocationDot,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faShieldHalved,
  faTrash,
  faTriangleExclamation,
  faUpRightFromSquare,
  faUserGroup,
  faXmark,
);

export { FontAwesomeIcon as Icon };
