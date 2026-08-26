"""Подстановка данных из тикетов шапки (Jira-артефактов релиза) и из расписания
пунктов в тексты пунктов плана — чтобы релизная ветка, номера тикетов и окно
проведения работ не дублировались руками в каждом пункте, а брались из одного
места и менялись сразу везде при правке шапки/дат.

Доступные плейсхолдеры (тикет с соответствующим kind ищется по release.tickets):
  {{sprint_key}}      — ключ тикета kind="sprint", напр. WEBSITE-52101
  {{sprint_label}}    — название тикета kind="sprint"
  {{sprint_branch}}   — "release/" + ключ тикета kind="sprint"
  {{sprint_url}}       — ссылка на тикет kind="sprint" в Jira
  {{sprint_link}}      — готовая markdown-ссылка "[KEY](url)" для kind="sprint"
  {{bundle_key}} / {{bundle_label}} / {{bundle_url}} / {{bundle_link}} — то же для kind="bundle"
  {{main_window}}       — "дд.мм.гггг чч:мм - чч:мм" (или с датой окончания, если
                          работы переходят на следующие сутки) по фактическим
                          датам начала/окончания пунктов раздела "Основные работы"
  {{main_admin}} / {{second_admin}} — администраторы из шапки релиза
"""

import re

from app.config import settings
from app.models import ReleasePlan

_PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")


def _ticket_by_kind(release: ReleasePlan, kind: str):
    return next((t for t in release.tickets if t.kind == kind), None)


def _jira_url(key: str) -> str:
    return f"{settings.jira_base_url.rstrip('/')}/browse/{key}"


def _main_window(release: ReleasePlan) -> str | None:
    main_items = [i for i in release.items if i.section == "main" and i.item_type == "work"]
    starts = [i.start_at for i in main_items if i.start_at]
    ends = [i.end_at for i in main_items if i.end_at]
    if not starts or not ends:
        return None
    start, end = min(starts), max(ends)
    if start.date() == end.date():
        return f"{start.strftime('%d.%m.%Y')} {start.strftime('%H:%M')} - {end.strftime('%H:%M')}"
    return f"{start.strftime('%d.%m.%Y %H:%M')} - {end.strftime('%d.%m.%Y %H:%M')}"


def build_placeholder_map(release: ReleasePlan) -> dict[str, str]:
    values: dict[str, str] = {}

    sprint = _ticket_by_kind(release, "sprint")
    if sprint:
        url = _jira_url(sprint.key)
        values["sprint_key"] = sprint.key
        values["sprint_label"] = sprint.label
        values["sprint_branch"] = f"release/{sprint.key}"
        values["sprint_url"] = url
        values["sprint_link"] = f"[{sprint.key}]({url})"

    bundle = _ticket_by_kind(release, "bundle")
    if bundle:
        url = _jira_url(bundle.key)
        values["bundle_key"] = bundle.key
        values["bundle_label"] = bundle.label
        values["bundle_url"] = url
        values["bundle_link"] = f"[{bundle.key}]({url})"

    window = _main_window(release)
    if window:
        values["main_window"] = window

    if release.main_admin:
        values["main_admin"] = release.main_admin
    if release.second_admin:
        values["second_admin"] = release.second_admin

    return values


def resolve_text(text: str | None, placeholders: dict[str, str]) -> str | None:
    if text is None:
        return None

    def _sub(match: re.Match) -> str:
        name = match.group(1)
        return placeholders.get(name, match.group(0))

    return _PLACEHOLDER_RE.sub(_sub, text)
