/**
 * Formal survivor-results composition made only from verified original RO UI rasters.
 * This is an original responsive arrangement of the official item-window chrome, not a claim that
 * ordinary RO shipped this survivor summary screen.
 */
import { useState } from "preact/hooks";
import type { RasterRegistry } from "./raster.ts";
import { RO_BUTTON_CHROME_IDS, RO_WINDOW_CHROME_IDS, RoThreeSliceButton, RoWindow, type RoChromeButtonState } from "./primitives.tsx";

export interface RoResultsRow {
  key: string;
  label: string;
  value: string;
  testId?: string;
}

export interface RoResultsModel {
  title: string;
  rows: RoResultsRow[];
  continueLabel: string;
  continueDisabled: boolean;
}

/** Exact raster dependencies for fail-closed tests and handoff review. */
export function formalResultsAssetIds(): string[] {
  return [...new Set([
    ...RO_WINDOW_CHROME_IDS.title,
    ...RO_WINDOW_CHROME_IDS.body,
    ...RO_WINDOW_CHROME_IDS.footer,
    ...RO_BUTTON_CHROME_IDS.off,
    ...RO_BUTTON_CHROME_IDS.hover,
    ...RO_BUTTON_CHROME_IDS.down,
    ...RO_BUTTON_CHROME_IDS.disabled,
  ])].sort();
}

function ResultsButton(props: {
  rasters: RasterRegistry;
  disabled: boolean;
  label: string;
  buttonRef: (element: HTMLButtonElement | null) => void;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const state: RoChromeButtonState = props.disabled ? "disabled" : pressed ? "down" : hovered || focused ? "hover" : "off";
  return RoThreeSliceButton({
    rasters: props.rasters,
    width: 112,
    scale: 2,
    label: props.label,
    state,
    disabled: props.disabled,
    testId: "continue",
    buttonRef: props.buttonRef,
    onFocus: () => setFocused(true),
    onBlur: () => { setFocused(false); setPressed(false); },
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => { setHovered(false); setPressed(false); },
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
    onPress: props.onPress,
  });
}

export function RoResultsWindow(props: {
  rasters: RasterRegistry;
  model: RoResultsModel;
  registerContinue: (element: HTMLButtonElement | null) => void;
  onContinue: () => void;
}) {
  return (
    <div
      class="ro-results-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={props.model.title}
      data-testid="results"
      data-ro-dialog="survivor-results-original-ro-raster"
      data-ro-semantic-reuse="official-item-window-as-survivor-results"
    >
      <div class="ro-results-window">
        {RoWindow({
          rasters: props.rasters,
          width: 300,
          height: 300,
          title: props.model.title,
          children: (
            <div class="ro-results-content">
              <div class="ro-results-rows">
                {props.model.rows.map((row) => (
                  <div class="ro-results-row" key={row.key}>
                    <span class="ro-results-label">{row.label}</span>
                    <span class="ro-results-value" data-testid={row.testId}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div class="ro-results-actions">
                <ResultsButton
                  rasters={props.rasters}
                  disabled={props.model.continueDisabled}
                  label={props.model.continueLabel}
                  buttonRef={props.registerContinue}
                  onPress={props.onContinue}
                />
              </div>
            </div>
          ),
        })}
      </div>
    </div>
  );
}
