import { useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";

export function ClockSettings({
  halfDurationMinutes,
  automaticPeriodChange,
  onApply,
  onCancel,
}: {
  halfDurationMinutes: number;
  automaticPeriodChange: boolean;
  onApply: (minutes: number, automatic: boolean) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState(String(halfDurationMinutes));
  const [automatic, setAutomatic] = useState(automaticPeriodChange);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onApply(Number(minutes), automatic);
      }}
    >
      <label>
        {t("halfDuration")}
        <input
          type="number"
          min={1}
          max={5040}
          step={1}
          required
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
        />
      </label>
      <label className="clock-setting-toggle">
        <input
          type="checkbox"
          checked={automatic}
          onChange={(event) => setAutomatic(event.target.checked)}
        />
        {t("automaticPeriodChange")}
      </label>
      <p className="dialog-description">{t("automaticPeriodChangeHelp")}</p>
      <p className="dialog-note">{t("clockSettingsSaved")}</p>
      <div className="dialog-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          {t("cancel")}
        </button>
        <button className="button primary">{t("apply")}</button>
      </div>
    </form>
  );
}
