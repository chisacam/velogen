import { type ToastStackProps } from "./panel-types";
import commonStyles from "./common-panel.module.css";

export function ToastStack({ toasts }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={commonStyles.toastStack}>
      {toasts.map((toast) => (
        <div key={toast.id} className={`${commonStyles.toastItem} ${commonStyles[toast.kind] || ''}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
