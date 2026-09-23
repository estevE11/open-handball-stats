import { useLayoutEffect, useRef } from "react";

type Option<T extends string> = { value: T; label: string };
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
}: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;
    const buttons = Array.from(group.querySelectorAll("button"));
    const update = () => {
      const active = buttons.find((button) => button.dataset.value === value);
      if (!active) return;
      group.style.setProperty("--selection-x", `${active.offsetLeft}px`);
      group.style.setProperty("--selection-y", `${active.offsetTop}px`);
      group.style.setProperty("--selection-width", `${active.offsetWidth}px`);
      group.style.setProperty("--selection-height", `${active.offsetHeight}px`);
    };
    update();
    const frame = requestAnimationFrame(() => {
      group.dataset.ready = "true";
    });
    const observer = new ResizeObserver(update);
    buttons.forEach((button) => observer.observe(button));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [value]);
  return (
    <div
      ref={ref}
      className={`segmented sliding-segments ${className}`}
      role="group"
      aria-label={label}
    >
      <span className="segment-selection" aria-hidden="true" />
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          data-value={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
