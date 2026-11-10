import { confirmDialog } from '@/composables/useConfirm';
import type { ClubLicenseDto, LicensingCatalogDto } from '@/types/api';
import { formatDate, formatPrice } from '@/utils/format';
import { firstChargeOn, subscriptionLabel, subscriptionPrice } from './plans';

/**
 * Reactivar la renovación vuelve a cobrar, así que pide confirmarlo dos veces: primero qué supone y después el importe
 * y el día del próximo cobro.
 */
export async function confirmResumeRenewal(license: ClubLicenseDto, catalog: LicensingCatalogDto): Promise<boolean> {
  const interval = license.interval ?? 'Monthly';
  const period = interval === 'Yearly' ? 'cada año' : 'cada mes';
  const price = formatPrice(subscriptionPrice(catalog, interval, license.staffSeats), catalog.currency);

  const first = await confirmDialog({
    title: 'Reactivar la renovación',
    message: `La licencia de ${license.clubName} (${subscriptionLabel(license.staffSeats).toLowerCase()}) volverá a renovarse sola ${period}, así que no acabará el ${formatDate(license.validUntil)}.`,
    confirmLabel: 'Continuar',
    cancelLabel: 'Dejarla como está',
  });
  if (!first) return false;

  return confirmDialog({
    title: '¿Seguro que quieres renovar?',
    message: `El ${formatDate(firstChargeOn(license))} se cobrarán ${price} y después ${period}, hasta que vuelvas a cancelar la renovación.`,
    confirmLabel: 'Sí, reactivar la renovación',
    cancelLabel: 'No, cancelar',
  });
}
