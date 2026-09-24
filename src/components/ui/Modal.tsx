import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
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
  const { t } = useTranslation();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
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
          onClose();
        startedOutside.current = false;
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          aria-label={t("close")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
