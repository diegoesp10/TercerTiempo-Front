import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faArrowRightArrowLeft,
  faArrowUpFromBracket,
  faCalendarCheck,
  faCamera,
  faChartLine,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleInfo,
  faFutbol,
  faHouse,
  faLocationDot,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faRotateRight,
  faShieldHalved,
  faTrash,
  faTriangleExclamation,
  faUpRightFromSquare,
  faUserGroup,
  faUserInjured,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

/**
 * Iconos de Font Awesome que usa la interfaz (solo los registrados aquí entran en el bundle).
 * Se usan como <Icon icon="chevron-down" />.
 */
library.add(
  faArrowLeft,
  faArrowRightArrowLeft,
  faArrowUpFromBracket,
  faCalendarCheck,
  faCamera,
  faChartLine,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleInfo,
  faFutbol,
  faHouse,
  faLocationDot,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faRotateRight,
  faShieldHalved,
  faTrash,
  faTriangleExclamation,
  faUpRightFromSquare,
  faUserGroup,
  faUserInjured,
  faXmark,
);

export { FontAwesomeIcon as Icon };
