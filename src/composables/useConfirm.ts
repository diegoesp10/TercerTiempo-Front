import { reactive } from 'vue';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción destructiva: el botón principal va en rojo. */
  danger?: boolean;
}

interface ConfirmState extends Required<ConfirmOptions> {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

// Un único diálogo para toda la app (ConfirmDialog en AppShell); confirmDialog() devuelve lo que elija el usuario.
export const confirmState = reactive<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Aceptar',
  cancelLabel: 'Cancelar',
  danger: false,
  resolve: null,
});

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  confirmState.resolve?.(false);
  confirmState.title = options.title;
  confirmState.message = options.message;
  confirmState.confirmLabel = options.confirmLabel ?? 'Aceptar';
  confirmState.cancelLabel = options.cancelLabel ?? 'Cancelar';
  confirmState.danger = options.danger ?? false;
  confirmState.open = true;
  return new Promise<boolean>((resolve) => { confirmState.resolve = resolve; });
}

export function settleConfirm(value: boolean) {
  confirmState.open = false;
  confirmState.resolve?.(value);
  confirmState.resolve = null;
}
