"""Подстановка данных из тикетов шапки (Jira-артефактов релиза) в тексты пунктов
плана — чтобы релизная ветка и номера тикетов не дублировались руками в каждом
пункте, а брались из одного места и менялись сразу везде при правке шапки.

Доступные плейсхолдеры (тикет с соответствующим kind ищется по release.tickets):
  {{sprint_key}}      — ключ тикета kind="sprint", напр. WEBSITE-52101
  {{sprint_label}}     — название тикета kind="sprint"
  {{sprint_branch}}    — "release/" + ключ тикета kind="sprint"
  {{bundle_key}}       — ключ тикета kind="bundle"
  {{bundle_label}}     — название тикета kind="bundle"
"""

import re

from app.models import ReleasePlan

_PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")


def _ticket_by_kind(release: ReleasePlan, kind: str):
    return next((t for t in release.tickets if t.kind == kind), None)


def build_placeholder_map(release: ReleasePlan) -> dict[str, str]:
    values: dict[str, str] = {}
    sprint = _ticket_by_kind(release, "sprint")
    if sprint:
        values["sprint_key"] = sprint.key
        values["sprint_label"] = sprint.label
        values["sprint_branch"] = f"release/{sprint.key}"
    bundle = _ticket_by_kind(release, "bundle")
    if bundle:
        values["bundle_key"] = bundle.key
        values["bundle_label"] = bundle.label
    return values


def resolve_text(text: str | None, placeholders: dict[str, str]) -> str | None:
    if text is None:
        return None

    def _sub(match: re.Match) -> str:
        name = match.group(1)
        return placeholders.get(name, match.group(0))

    return _PLACEHOLDER_RE.sub(_sub, text)
