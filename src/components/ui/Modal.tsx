import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
export function Modal({
  title,
  children,
  onClose,
  variant = "default",
  className = "",
}: {
  variant?: "default" | "drawer";
  className?: string;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const startedOutside = useRef(false);
  function outside(clientX: number, clientY: number) {
    const bounds = ref.current?.getBoundingClientRect();
    return Boolean(
      bounds &&
      (clientX < bounds.left ||
        clientX > bounds.right ||
        clientY < bounds.top ||
        clientY > bounds.bottom),
    );
  }
  function dismiss() {
    if (variant === "drawer") setClosing(true);
    else onClose();
  }
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onClose, 180);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);
  const { t } = useTranslation();
  useLayoutEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${variant === "drawer" ? "drawer" : ""} ${closing ? "is-closing" : ""} ${className}`}
      aria-labelledby={id}
      onPointerDown={(event) => {
        startedOutside.current =
          event.target === event.currentTarget &&
          outside(event.clientX, event.clientY);
      }}
      onClick={(event) => {
        if (
          startedOutside.current &&
          event.target === event.currentTarget &&
          outside(event.clientX, event.clientY)
        )
          dismiss();
        startedOutside.current = false;
      }}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
    >
      <div className="modal-heading">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          aria-label={t("close")}
          onClick={dismiss}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
