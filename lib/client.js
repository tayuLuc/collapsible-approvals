// collapsible-approvals/client — collapse for "Waiting for approval" cards,
// rewritten 2026-08-25 to own the composer seat the vanilla way (the exact
// pattern dsh-client-ui-user-questions uses for question cards):
//   - register into the "conversation.composer" chain with select(kind=approval)
//     and priority 2, so this panel replaces core's ApprovalPanel (priority 1)
//     when an approval interaction pends;
//   - React component over the carrier ({ matched }) with the standard kit
//     (t, useSession) — no MutationObserver, no DOM patching;
//   - collapse = React state + conditional render of body/actionRow, chevron
//     iconButtons in the header (aria-expanded), per-key state in localStorage
//     (v1 map adopted).
window.__ModuleLoader__.load({
	id: "collapsible-approvals",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react_jsx_runtime = require("react/jsx-runtime");
		const react = require("react");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		// dsh 0.1.2-rc.1 dropped the @deepseek-ai/dsh-client-runtime/client seed
		// word; conversationContextKey is a stable one-liner (format verified
		// identical in old and new builds) — inline it instead of requiring.
		const conversationContextKey = (kind, id) => `${kind.length}:${kind}${id}`;

		const name = "collapsible-approvals";
		const inject = ["slots", "locale"];
		const NS = "collapsible-approvals";
		const SLOT = "conversation.composer";

		function toolNode(node) {
			return node?.kind === "tool-call" ? node : void 0;
		}
		function rootToolCall(snapshot, rootCallId) {
			return toolNode(snapshot.chat.nodes.get(conversationContextKey("tool-call", rootCallId)))?.data.root;
		}
		function commandOf(call) {
			if (call === void 0) return void 0;
			try {
				const args = JSON.parse(call.argsRaw);
				return typeof args.command === "string" ? args.command : void 0;
			} catch {
				return void 0;
			}
		}

		// ---------- Styles (theme tokens mirror core ApprovalPanel.module.css) ----------
		const STYLE_TAG = "@deepseek-ai/../plugins/collapsible-approvals/panel.module.css";
		const css = [
			".capp_root{padding:8px calc(var(--dsh-composer-side-clearance) + 16px) 12px;flex-direction:column;align-items:center;display:flex}",
			".capp_card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-shadow-lv2);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:20px;overflow:hidden}",
			".capp_strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}",
			".capp_dot{background:var(--dsw-alias-state-warn-primary);border-radius:50%;width:8px;height:8px;flex:none}",
			".capp_headerActions{flex:none;align-items:center;gap:4px;display:flex;margin-left:auto}",
			".capp_iconButton{width:24px;height:24px;color:var(--dsw-alias-state-warn-primary);cursor:pointer;background:0 0;border:none;border-radius:999px;place-items:center;padding:0;display:grid}",
			".capp_iconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".capp_iconButton:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
			".capp_body{box-sizing:border-box;max-height:var(--dsh-composer-text-max-height);flex-direction:column;gap:6px;padding:12px 16px 0;display:flex;overflow-y:auto}",
			".capp_headline{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:500;line-height:24px}",
			".capp_command{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);word-break:break-all;font-size:13px;line-height:20px}",
			".capp_actionRow{justify-content:flex-end;gap:8px;padding:14px 16px;display:flex}",
			".capp_reject:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-color:#0000}",
			".capp_feedback{min-height:16px;color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}"
		].join("");
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_TAG) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = name;
			tag.dataset.pluginCss = STYLE_TAG;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		// ---------- Locale ----------
		const zh = {
			"approval.waiting": "等待审批",
			"approval.detail.aria": "审批详情",
			"approval.escalation": "工具 {toolName} 请求越权执行",
			"approval.reject": "拒绝",
			"approval.allowOnce": "允许一次",
			"nav.minimize": "收起详情",
			"nav.maximize": "展开详情"
		};
		const en = {
			"approval.waiting": "Waiting for approval",
			"approval.detail.aria": "Approval details",
			"approval.escalation": "Tool {toolName} is requesting elevated execution",
			"approval.reject": "Reject",
			"approval.allowOnce": "Allow once",
			"nav.minimize": "Collapse details",
			"nav.maximize": "Expand details"
		};

		// ---------- Per-key persisted collapse (v1 map adopted for continuity) ----------
		const LS_KEY = "collapsible-approvals.collapsed.v2";
		const LS_LEGACY = "collapsible-approvals.collapsed.v1";
		const LS_CAP = 200;
		let collapsedMap = null;
		function loadMap() {
			if (collapsedMap !== null) return collapsedMap;
			collapsedMap = {};
			try {
				for (const source of [LS_KEY, LS_LEGACY]) {
					const raw = JSON.parse(localStorage.getItem(source) ?? "{}");
					if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
						for (const [k, v] of Object.entries(raw)) if (v === true) collapsedMap[k] = true;
					}
					if (source === LS_LEGACY && Object.keys(collapsedMap).length > 0) break;
				}
			} catch {
				collapsedMap = {};
			}
			return collapsedMap;
		}
		function persist(key, collapsed) {
			const map = loadMap();
			if (collapsed) map[key] = true;
			else delete map[key];
			const keys = Object.keys(map);
			if (keys.length > LS_CAP) {
				for (const stale of keys.slice(0, keys.length - LS_CAP)) delete map[stale];
			}
			try {
				localStorage.setItem(LS_KEY, JSON.stringify(map));
			} catch {
				/* storage full/blocked — state just won't persist */
			}
		}

		// ---------- Components ----------
		function CollapsibleApprovalFlow({ pending, command, t }) {
			const [answered, setAnswered] = react.useState(false);
			const [error, setError] = react.useState(null);
			const [minimized, setMinimized] = react.useState(() => loadMap()[pending.key] === true);
			const toggle = () => {
				setMinimized((current) => {
					persist(pending.key, !current);
					return !current;
				});
			};
			const answer = (outcome) => {
				setAnswered(true);
				setError(null);
				pending.answer(outcome).catch((cause) => {
					setAnswered(false);
					setError(cause instanceof Error ? cause.message : String(cause));
				});
			};
			return react_jsx_runtime.jsx("div", {
				className: "capp_root",
				"data-approval-key": pending.key,
				children: react_jsx_runtime.jsxs("div", {
					className: "capp_card",
					children: [
						react_jsx_runtime.jsxs("div", {
							className: "capp_strip",
							children: [
								react_jsx_runtime.jsx("span", { className: "capp_dot" }),
								t("approval.waiting"),
								react_jsx_runtime.jsx("div", {
									className: "capp_headerActions",
									children: react_jsx_runtime.jsx("button", {
										type: "button",
										className: "capp_iconButton",
										"aria-label": t(minimized ? "nav.maximize" : "nav.minimize"),
										title: t(minimized ? "nav.maximize" : "nav.minimize"),
										"aria-expanded": !minimized,
										disabled: answered,
										onClick: toggle,
										children: minimized
											? react_jsx_runtime.jsx(primitives.IconChevronUpOutline14, {})
											: react_jsx_runtime.jsx(primitives.IconChevronDownOutline14, {})
									})
								})
							]
						}),
						!minimized && react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
							children: [
								react_jsx_runtime.jsxs("div", {
									className: "capp_body",
									"data-approval-scroll": "",
									tabIndex: 0,
									role: "group",
									"aria-label": t("approval.detail.aria"),
									children: [
										react_jsx_runtime.jsx("div", {
											className: "capp_headline",
											children: pending.reason ?? t("approval.escalation", { toolName: pending.toolName })
										}),
										command !== void 0 && react_jsx_runtime.jsx("div", {
											className: "capp_command",
											children: command
										})
									]
								}),
								react_jsx_runtime.jsxs("div", {
									className: "capp_actionRow",
									children: [
										react_jsx_runtime.jsx(primitives.Button, {
											variant: "outline",
											className: "capp_reject",
											disabled: answered,
											onClick: () => {
												answer("rejected");
											},
											children: t("approval.reject")
										}),
										react_jsx_runtime.jsx(primitives.Button, {
											variant: "primary",
											disabled: answered,
											onClick: () => {
												answer("allowed-once");
											},
											children: answered ? "…" : t("approval.allowOnce")
										})
									]
								}),
								error !== null && react_jsx_runtime.jsx("div", {
									className: "capp_feedback",
									role: "status",
									style: { padding: "0 16px 10px" },
									children: error
								})
							]
						})
					]
				})
			});
		}

		function CollapsibleApprovalPanel(props) {
			const approval = props.matched;
			const command = props.useSession((snapshot) => {
				if (approval.callId === void 0) return void 0;
				const root = rootToolCall(snapshot, approval.callId);
				if (root === void 0) return void 0;
				return root.callId === approval.callId && !("kind" in root) ? commandOf(root) : void 0;
			});
			return react_jsx_runtime.jsx(CollapsibleApprovalFlow, {
				pending: approval,
				t: props.t,
				...command === void 0 ? {} : { command }
			}, approval.key);
		}

		// ---------- Chain routing ----------
		function selectApproval({ pendingInteraction }) {
			return pendingInteraction?.kind === "approval" ? pendingInteraction : null;
		}

		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "collapsible-approvals: dictionaries");
			ctx.slots.inject(SLOT, () => ctx.slots.register({
				name: SLOT,
				select: selectApproval,
				priority: 2, // outrank core ApprovalPanel (priority 1): we replace it on approvals
				locale: NS
			}, CollapsibleApprovalPanel));
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
