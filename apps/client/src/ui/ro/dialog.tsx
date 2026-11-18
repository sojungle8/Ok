/**
 * Formal survivor-draft composition made only from verified original RO UI rasters.
 * The simulation stays outside this guarded module and supplies a plain view model.
 * `ui.chat.window.*` is intentionally reused as the neutral option body; the reuse is
 * declared in the DOM so it can never be mistaken for a pixel-identical original RO dialog.
 */
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { RasterRegistry, VerifiedRaster } from "./raster.ts";
import { RO_BUTTON_CHROME_IDS, RoRaster, RoThreeSlice, RoThreeSliceButton, type RoChromeButtonState } from "./primitives.tsx";

const TITLE = ["ui.window.title.left", "ui.window.title.mid", "ui.window.title.right"] as const;
const CHAT_BODY = ["ui.chat.window.left", "ui.chat.window.mid", "ui.chat.window.right"] as const;

export interface RoDraftChoiceModel {
  key: string;
  title: string;
  kind: string;
  lines: string[];
  iconId: string | null;
}

export interface RoDraftModel {
  title: string;
  choices: RoDraftChoiceModel[];
  focused: number;
}

function three(rasters: RasterRegistry, ids: readonly [string, string, string]): [VerifiedRaster, VerifiedRaster, VerifiedRaster] {
  return [rasters.get(ids[0]), rasters.get(ids[1]), rasters.get(ids[2])];
}

/** Exact raster dependencies for fail-closed tests and handoff review. */
export function formalDraftAssetIds(model: RoDraftModel): string[] {
  const ids = new Set<string>([
    ...TITLE,
    ...CHAT_BODY,
    "ui.slot.selection",
    ...RO_BUTTON_CHROME_IDS.off,
    ...RO_BUTTON_CHROME_IDS.hover,
    ...RO_BUTTON_CHROME_IDS.down,
    ...RO_BUTTON_CHROME_IDS.disabled,
  ]);
  for (const choice of model.choices) if (choice.iconId !== null) ids.add(choice.iconId);
  return [...ids].sort();
}

function TitleStrip({ rasters, text, className = "" }: { rasters: RasterRegistry; text: string; className?: string }) {
  const [left, mid, right] = three(rasters, TITLE);
  return (
    <div class={`ro-draft-title-strip ${className}`}>
      {RoThreeSlice({ left, mid, right, width: 300 })}
      <span>{text}</span>
    </div>
  );
}

function ChatBody({ rasters, children }: { rasters: RasterRegistry; children?: ComponentChildren }) {
  const [left, mid, right] = three(rasters, CHAT_BODY);
  return (
    <div class="ro-draft-chat-body" data-ro-semantic-reuse="official-chat-window-as-survivor-draft">
      {RoThreeSlice({ left, mid, right, width: 300 })}
      <div class="ro-draft-chat-content">{children}</div>
    </div>
  );
}

function DraftButton(props: {
  rasters: RasterRegistry;
  width: number;
  label: string;
  selected?: boolean;
  testId: string;
  buttonRef?: (element: HTMLButtonElement | null) => void;
  onFocus?: () => void;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const state: RoChromeButtonState = pressed ? "down" : hovered || focused || props.selected ? "hover" : "off";
  return RoThreeSliceButton({
    rasters: props.rasters,
    width: props.width,
    scale: 2,
    label: props.label,
    state,
    testId: props.testId,
    buttonRef: props.buttonRef ?? (() => undefined),
    onFocus: () => { setFocused(true); props.onFocus?.(); },
    onBlur: () => { setFocused(false); setPressed(false); },
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => { setHovered(false); setPressed(false); },
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
    onPress: props.onPress,
  });
}

export function RoDraftWindow(props: {
  rasters: RasterRegistry;
  model: RoDraftModel;
  onChoose: (index: number) => void;
  onFocus: (index: number) => void;
  registerButton: (index: number, element: HTMLButtonElement | null) => void;
}) {
  return (
    <div class="ro-draft-dialog" role="dialog" aria-modal="true" data-testid="draft" data-ro-dialog="survivor-draft-original-ro-raster">
      <TitleStrip rasters={props.rasters} text={props.model.title} className="ro-draft-heading" />
      <div class="ro-draft-options">
        {props.model.choices.map((choice, index) => (
          <div class="ro-draft-option" key={choice.key} data-ro-focused={props.model.focused === index ? "true" : "false"}>
            <TitleStrip rasters={props.rasters} text={`${index + 1} · ${choice.title}`} />
            <ChatBody rasters={props.rasters}>
              {choice.iconId === null ? null : <div class="ro-draft-icon">{RoRaster({ raster: props.rasters.get(choice.iconId) })}</div>}
              {props.model.focused === index ? <div class="ro-draft-selection" data-ro-selection-marker="official-slot-selection">{RoRaster({ raster: props.rasters.get("ui.slot.selection") })}</div> : null}
              <span class="ro-draft-kind">{choice.kind}</span>
              <span class="ro-draft-lines">{choice.lines.slice(0, 4).map((line) => <span key={line}>{line}</span>)}</span>
              <div class="ro-draft-action">
                <DraftButton
                  rasters={props.rasters}
                  width={88}
                  label={`${index + 1} 選擇`}
                  selected={props.model.focused === index}
                  onPress={() => props.onChoose(index)}
                  onFocus={() => props.onFocus(index)}
                  buttonRef={(element) => props.registerButton(index, element)}
                  testId={`option-${index}`}
                />
              </div>
            </ChatBody>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoDraftConfirm(props: {
  rasters: RasterRegistry;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  registerConfirm: (element: HTMLButtonElement | null) => void;
}) {
  return (
    <div class="ro-draft-dialog ro-draft-confirm" role="dialog" aria-modal="true" data-testid="keystone-confirm" data-ro-dialog="survivor-keystone-confirm-original-ro-raster">
      <TitleStrip rasters={props.rasters} text={props.title} className="ro-draft-heading" />
      <ChatBody rasters={props.rasters}>
        <span class="ro-draft-confirm-message">{props.message}</span>
        <div class="ro-draft-confirm-actions">
          <DraftButton rasters={props.rasters} width={112} label="確認 Enter / A" onPress={props.onConfirm} buttonRef={props.registerConfirm} testId="confirm" />
          <DraftButton rasters={props.rasters} width={112} label="返回 Esc / B" onPress={props.onCancel} testId="cancel" />
        </div>
      </ChatBody>
    </div>
  );
}
