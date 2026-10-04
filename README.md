# collapsible-approvals

Browser-client plugin: pending approval cards get a collapse chevron.

## What it does

Owns the `conversation.composer` seat for approval interactions. Registers with
`select(kind=approval)` and priority 2, so it replaces the core ApprovalPanel
(priority 1) while an approval is pending: a React card with a header chevron
(`aria-expanded`); collapse is React state + conditional render of the body/action
row — no DOM patching. Per-key collapsed state persists in localStorage (v1 map).

The point: a long approval prompt no longer eats the whole viewport while you keep
reading the rest of the turn — fold the card, it stays actionable.

## Install

```bash
dsh plugin --profile web add <path-to-this-repo>
```

`cordis.patch.yml` inserts the plugin row into the profile roster. Activation needs
a host restart. Platform: web client (`dsh.client.platform: web`).
