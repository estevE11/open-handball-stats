import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";

export function ClockEditor({
  seconds,
  onApply,
  onCancel,
}: {
  seconds: number;
  onApply: (seconds: number) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const initial = Math.min(604799, Math.max(0, Math.floor(seconds)));
  const [minutes, setMinutes] = useState(
    String(Math.floor(initial / 60)).padStart(2, "0"),
  );
  const [secondDigits, setSecondDigits] = useState(
    String(initial % 60).padStart(2, "0"),
  );
  const groups = [
    { name: "minutes" as const, digits: minutes, set: setMinutes },
    { name: "seconds" as const, digits: secondDigits, set: setSecondDigits },
  ];
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onApply(Number(minutes) * 60 + Number(secondDigits));
      }}
    >
      <p className="dialog-description">{t("clockHelp")}</p>
      <div className="digit-clock">
        {groups.map(({ name, digits, set }, groupIndex) => (
          <div
            className="digit-group"
            key={name}
            role="group"
            aria-label={t(name)}
          >
            <span className="digit-group-label">{t(name)}</span>
            <div className="digit-row">
              {groupIndex === 1 && (
                <span className="digit-colon" aria-hidden="true">
                  :
                </span>
              )}
              {Array.from(digits).map((digit, index) => {
                const label = `${t(name)} · ${t("digit")} ${index + 1}`;
                const max = name === "seconds" && index === 0 ? 5 : 9;
                const change = (next: number) => {
                  const nextDigits =
                    digits.slice(0, index) + next + digits.slice(index + 1);
                  if (name === "minutes" && Number(nextDigits) > 10079) return;
                  set(nextDigits);
                };
                const step = (direction: number) =>
                  change((Number(digit) + direction + max + 1) % (max + 1));
                return (
                  <div className="clock-digit" key={index}>
                    <button
                      type="button"
                      className="digit-step"
                      aria-label={`${t("increase")} ${label}`}
                      onClick={() => step(1)}
                    >
                      <ChevronUp size={20} />
                    </button>
                    <input
                      aria-label={label}
                      inputMode="numeric"
                      pattern={`[0-${max}]`}
                      maxLength={1}
                      value={digit}
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) => {
                        if (new RegExp(`^[0-${max}]$`).test(event.target.value))
                          change(Number(event.target.value));
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === "ArrowUp" ||
                          event.key === "ArrowDown"
                        ) {
                          event.preventDefault();
                          step(event.key === "ArrowUp" ? 1 : -1);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="digit-step"
                      aria-label={`${t("decrease")} ${label}`}
                      onClick={() => step(-1)}
                    >
                      <ChevronDown size={20} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="dialog-note">{t("digitHelp")}</p>
      <div className="dialog-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          {t("cancel")}
        </button>
        <button className="button primary">{t("apply")}</button>
      </div>
    </form>
  );
}
