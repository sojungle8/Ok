import { useEffect, useRef, useState } from "preact/hooks";
import type { RunContent, RunState } from "@ro-survivor/core-sim";
import { describeOption } from "../game/describe.ts";

/** Draft and keystone-confirm modal: mouse, touch, number keys, arrows + Enter, and gamepad (D-pad / A / B). Focus is always visible. */
export function DraftModal({ content, st, onChoose, onConfirm, onCancel }: { content: RunContent; st: RunState; onChoose: (i: number) => void; onConfirm: () => void; onCancel: () => void }) {
  const [focus, setFocus] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const confirming = st.phase === "keystone-confirm";
  const options = st.draft?.options ?? [];
  useEffect(() => {
    refs.current[focus]?.focus();
  }, [focus, confirming, options.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (confirming) {
        if (e.key === "Enter" || e.key === "y") onConfirm();
        if (e.key === "Escape" || e.key === "n") onCancel();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) onChoose(n - 1);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setFocus((f) => (f + 1) % options.length);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") setFocus((f) => (f + options.length - 1) % options.length);
    };
    window.addEventListener("keydown", key);
    let raf = 0;
    let prev: boolean[] = [];
    const poll = (): void => {
      raf = requestAnimationFrame(poll);
      const pad = typeof navigator.getGamepads === "function" ? [...navigator.getGamepads()].find((p): p is Gamepad => p !== null) : undefined;
      if (!pad) return;
      const now = pad.buttons.map((b) => b.pressed);
      const edge = (i: number): boolean => now[i] === true && prev[i] !== true;
      if (confirming) {
        if (edge(0)) onConfirm();
        if (edge(1)) onCancel();
      } else {
        if (edge(15) || edge(13)) setFocus((f) => (f + 1) % options.length);
        if (edge(14) || edge(12)) setFocus((f) => (f + options.length - 1) % options.length);
        if (edge(0)) setFocus((f) => (onChoose(f), f));
      }
      prev = now;
    };
    raf = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener("keydown", key);
      cancelAnimationFrame(raf);
    };
  }, [confirming, options.length, onChoose, onConfirm, onCancel]);

  if (confirming) {
    return (
      <div class="modal" role="dialog" aria-modal="true" data-testid="keystone-confirm">
        <h2>確認流派：{st.pendingKeystone?.replace("keystone.", "")}</h2>
        <p>流派一局只能選一次，確定嗎？</p>
        <div class="row">
          <button ref={(el) => { refs.current[0] = el; }} onClick={onConfirm} data-testid="confirm">確認（Enter / A）</button>
          <button onClick={onCancel} data-testid="cancel">返回（Esc / B）</button>
        </div>
      </div>
    );
  }
  return (
    <div class="modal" role="dialog" aria-modal="true" data-testid="draft">
      <h2>{st.draft?.source === "keystone" || options.every((o) => o.kind === "keystone") ? "選擇流派" : st.draft?.source === "chest" ? "寶箱獎勵" : `升級！Lv ${st.player.level}`}</h2>
      <div class="cards">
        {options.map((o, i) => {
          const d = describeOption(content, st, o);
          return (
            <button key={`${o.kind}:${o.id}`} ref={(el) => { refs.current[i] = el; }} class={`card ${focus === i ? "focused" : ""}`} onClick={() => onChoose(i)} onFocus={() => setFocus(i)} data-testid={`option-${i}`}>
              <span class="num">{i + 1}</span>
              <strong>{d.title}</strong>
              <small>{o.kind}</small>
              <ul>{d.lines.map((l) => <li key={l}>{l}</li>)}</ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
