from datetime import datetime

import requests
import urllib3
from requests.auth import HTTPBasicAuth
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Comment, SyncState, Task

# Jira тут — внутренний сервер с сертификатом, которому Python не доверяет по умолчанию,
# и это ожидаемо в данной сети. Отключаем проверку SSL и глушим предупреждение urllib3 об этом.
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

FIELDS = [
    "summary",
    "description",
    "status",
    "issuetype",
    "priority",
    "project",
    "assignee",
    "reporter",
    "created",
    "updated",
    "resolutiondate",
    "comment",
]

PAGE_SIZE = 100


class JiraSyncError(RuntimeError):
    pass


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%f%z")
    except ValueError:
        return None


def _field_name(field: dict | None) -> str | None:
    if not field:
        return None
    return field.get("displayName") or field.get("name")


def _make_session() -> requests.Session:
    session = requests.Session()
    session.auth = HTTPBasicAuth(settings.jira_username, settings.jira_password)
    session.verify = False
    session.headers.update(
        {
            "Accept": "application/json",
            "X-Atlassian-Token": "no-check",
        }
    )
    return session


def _fetch_page(session: requests.Session, url: str, start_at: int) -> dict:
    try:
        resp = session.post(
            url,
            json={
                "jql": settings.jira_jql,
                "startAt": start_at,
                "maxResults": PAGE_SIZE,
                "fields": FIELDS,
            },
            timeout=30,
        )
    except requests.exceptions.SSLError as exc:
        raise JiraSyncError(f"Ошибка SSL при подключении к Jira: {exc}") from exc
    except requests.exceptions.ConnectionError as exc:
        raise JiraSyncError(f"Не удалось подключиться к {settings.jira_base_url}: {exc}") from exc
    except requests.exceptions.Timeout as exc:
        raise JiraSyncError("Jira не ответила за 30 секунд (таймаут)") from exc
    except requests.exceptions.RequestException as exc:
        raise JiraSyncError(f"Ошибка запроса к Jira: {exc}") from exc

    if resp.status_code == 401:
        raise JiraSyncError("Jira вернула 401 Unauthorized — проверьте логин/пароль в .env")
    if not resp.ok:
        raise JiraSyncError(f"Jira вернула ошибку {resp.status_code}: {resp.text[:500]}")

    try:
        return resp.json()
    except ValueError as exc:
        raise JiraSyncError(
            "Jira вернула не JSON, а что-то другое (возможно, HTML-страницу логина "
            f"или ошибку прокси). Начало ответа: {resp.text[:300]!r}"
        ) from exc


def _upsert_issue(db: Session, raw: dict) -> None:
    key = raw["key"]
    fields = raw["fields"]

    status = fields.get("status") or {}
    status_category = (status.get("statusCategory") or {}).get("key", "new")

    task = db.get(Task, key)
    if task is None:
        task = Task(key=key)
        db.add(task)

    task.summary = fields.get("summary") or ""
    task.description = fields.get("description")
    task.status = status.get("name", "Unknown")
    task.status_category = status_category
    task.issue_type = (fields.get("issuetype") or {}).get("name")
    task.priority = (fields.get("priority") or {}).get("name")
    task.project_key = (fields.get("project") or {}).get("key")
    task.assignee = _field_name(fields.get("assignee"))
    task.reporter = _field_name(fields.get("reporter"))
    task.created = _parse_dt(fields.get("created"))
    task.updated = _parse_dt(fields.get("updated"))
    task.resolved = _parse_dt(fields.get("resolutiondate"))

    db.query(Comment).filter(Comment.task_key == key).delete()
    comment_field = fields.get("comment") or {}
    for c in comment_field.get("comments", []):
        db.add(
            Comment(
                id=int(c["id"]),
                task_key=key,
                author=_field_name(c.get("author")),
                body=c.get("body"),
                created=_parse_dt(c.get("created")),
                updated=_parse_dt(c.get("updated")),
            )
        )


def sync(db: Session) -> tuple[int, int]:
    if not settings.jira_base_url:
        raise JiraSyncError("JIRA_BASE_URL не задан в .env")

    session = _make_session()
    url = f"{settings.jira_base_url.rstrip('/')}/rest/api/2/search"

    start_at = 0
    tasks_synced = 0

    # Коммитим постранично, а не одной большой транзакцией в конце: при большом
    # количестве задач синхронизация может занять минуты, и без промежуточных
    # коммитов SQLite всё это время держит блокировку на запись, из-за чего
    # страница со списком задач/статистикой у пользователя просто "висит".
    while True:
        data = _fetch_page(session, url, start_at)
        batch = data.get("issues", [])

        for raw in batch:
            _upsert_issue(db, raw)
        db.commit()
        tasks_synced += len(batch)

        total = data.get("total", 0)
        start_at += len(batch)
        if start_at >= total or not batch:
            break

    comments_count = db.query(Comment).count()

    state = db.get(SyncState, 1)
    if state is None:
        state = SyncState(id=1)
        db.add(state)
    state.last_sync = datetime.now().astimezone()
    state.last_sync_tasks_count = tasks_synced
    db.commit()

    return tasks_synced, comments_count
