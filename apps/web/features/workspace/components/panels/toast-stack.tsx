import { type ToastStackProps } from "./panel-types";

export function ToastStack({ toasts }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toastStack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toastItem ${toast.kind}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
