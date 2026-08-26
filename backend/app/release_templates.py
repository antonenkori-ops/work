"""Дефолтный набор пунктов для Планового релиза — скопирован из наброски/План работ.xlsx
(релиз АС "Веб-сайт Сбербанка России" + SberCraft), включая реальные списки хостов
Syngx/Zabbix из примера. Пользователь правит/удаляет/добавляет пункты после создания
релиза; здесь только стартовый набор.

TODO (по договорённости, не в этой итерации): списки хостов сейчас захардкожены
под "Веб-сайт Сбербанка России" — позже стоит вынести их в такой же переиспользуемый
набор, как ReleaseModuleSet, но привязанный к конкретной АС, чтобы для другого
релиза подставлялся свой список хостов.
"""

from sqlalchemy.orm import Session

from app.models import (
    ReleaseItem,
    ReleaseModuleSet,
    ReleaseModuleSetEntry,
    ReleasePlan,
    ReleaseRisk,
    ReleaseTicket,
)

TEAM_MAIN = "ДИТ ДМиК. Сопровождение АС ГАК Технологии маркетинга\n({{main_admin}}, {{second_admin}})"
TEAM_PREP = "ДИТ ДМиК. Сопровождение АС ГАК Технологии маркетинга\n({{main_admin}})"

DEFAULT_TITLE = "АС Веб-сайт Сбербанк России"
DEFAULT_MAIN_ADMIN = "Антоненко Р.И."
DEFAULT_SECOND_ADMIN = "Писарьков М.В."

DEFAULT_TICKETS = [
    {"label": "WebSite.2026.Sprint 224", "key": "WEBSITE-52101", "kind": "sprint"},
    {"label": "SberCraft. Бандл 1.36", "key": "SBERCRAFT-6693", "kind": "bundle"},
    {"label": "РоВ", "key": "WEBSITE-52381", "kind": "rov"},
    {"label": "РоВ", "key": "SBERCRAFT-6846", "kind": "rov"},
]

MODULES_SITE = [
    ("deposit", "D-03.032.000"),
    ("dict-gosprogram-catalog", "D-03.015.000"),
    ("dict-product", "D-03.017.001"),
    ("document", "D-03.009.000"),
    ("front-corp-components", "D-03.001.000"),
    ("front-sberbank-admin", "D-03.037.000"),
    ("gigasearch", "D-03.016.000"),
    ("node-deposit-microfront", "D-03.013.000"),
    ("node-table-microfront", "D-03.015.000"),
]

MODULES_SBERCRAFT = [
    ("front-admin-constructor", "D-03.093.000"),
    ("front-admin", "D-03.068.004"),
    ("front-ai-widgets", "D-03.000.000"),
    ("front-universal-containers", "D-03.033.000"),
    ("front-zeroblock-layout", "D-03.030.000"),
    ("front-zeroblock-universal", "D-03.033.000"),
    ("gigachat", "D-03.023.000"),
    ("sbercraft-cms", "D-03.076.000"),
    ("sbercraft-dict", "D-03.024.000"),
]

MODULE_SETS = {
    "site": MODULES_SITE,
    "sbercraft": MODULES_SBERCRAFT,
}

NODE_PAGE_RENDERER_NOTE = (
    "Если в релизе присутствует модуль node-page-renderer, то его рекомендуется "
    "обновлять после деплоя всех микрофронтов"
)
DECISION_CONTINUE_NOTE = "Принятие решения о продолжении работ"

# Каждый пункт секции: title, duration_minutes (None = без длительности/чек-пункт),
# executor, comment (может быть None), modules (опционально — список (name, version))
PREP_ITEMS = [
    dict(
        title="Внесение изменений в инвентори стендов",
        duration_minutes=120,
        executor=TEAM_PREP,
        comment=None,
    ),
    dict(
        title="Публикация объявления на портале",
        duration_minutes=30,
        executor=TEAM_PREP,
        comment=(
            "‼️⚙️Запланированы работы.\n"
            "{{sprint_link}} {{sprint_label}}\n"
            "{{bundle_link}} {{bundle_label}}\n"
            "Компоненты: см. тикет\n"
            "Дата и время: {{main_window}}\n"
            "Влияние: не планируется\n"
            "Просьба воздержаться от работы в административных консолях сайта "
            "в период проведения работ"
        ),
    ),
]

MAIN_ITEMS = [
    dict(
        title=(
            "Проверить выполнение подготовительных работ.\n"
            "Убедиться, что нет инцидентов и работ на инфраструктуре, влияющих на "
            "установку релиза.\n"
            "Убедиться в отсутствии алертов в Alerta, мешающих внедрению релиза.\n"
            "Убедиться в отсутствии не смерженных pull request'ов в релизные ветки "
            "репозиториев (основной, Syngx и др.).\n"
            "Убедиться в отсутствии diff'а инвентори-файлов между master и релизной "
            "веткой (выполнить rebase по master/main)."
        ),
        duration_minutes=None,
        executor=TEAM_MAIN,
        comment="Написать сообщение в Сберчат о начале работ",
    ),
    dict(
        title=(
            "Включить подавление событий инфраструктурного Zabbix\n"
            "Установка silence в AlertManager:\n"
            'alertname="Syngx monitoring endpoint - down"\n'
            'alertname="Syngx - down"\n'
            'alertname="К приложению subscription ФП Prime/Promo отсутствуют запросы"\n'
            'alertname="К приложению authorization ФП Prime/Promo отсутствуют запросы"'
        ),
        duration_minutes=10,
        executor=TEAM_MAIN,
        comment=(
            "https://rlm.sigma.sbrf.ru/dashboard/services/UVS_ZABBIX_EVENT_SUPRESSOR\n"
            "(максимальное время 240 мин)\n"
            "pslsw-site00005\npslsw-site00006\npslsw-site00007\npslsw-site00008\n\n"
            "pvlsw-site00185\npvlsw-site00186\npvlsw-site00187\npvlsw-site00188\n"
            "pvlsw-site00189\npvlsw-site00190\npvlsw-site00191\npvlsw-site00192\n"
            "pvlsw-site00193\npvlsw-site00194\npvlsw-site00195\npvlsw-site00196\n"
            "pvlsw-site00197\npvlsw-site00198\npvlsw-site00199\npvlsw-site00200\n"
            "pvlsw-site00201\npvlsw-site00202\npvlsw-site00203\npvlsw-site00204\n"
            "pvlsw-site00205\npvlsw-site00206\npvlsw-site00207\npvlsw-site00208\n\n"
            "+ хосты БН\n"
            "pvlsb-site00029\npvlsb-site00030\npvlsb-site00031\npvlsb-site00032\n"
            "pvlsb-site00033\npvlsb-site00034\npvlsb-site00035\npvlsb-site00036\n"
            "pvlsb-site00037\npvlsb-site00038\npvlsb-site00039\npvlsb-site00040\n"
            "pvlsb-site00041\npvlsb-site00042\npvlsb-site00043\npvlsb-site00044"
        ),
    ),
    dict(
        title=(
            "Остановить INT и EXT Syngx в СЦОД.\n"
            "Запуск джобы Syngx_operations с параметрами:\n"
            "operation: stop\ninventory: promsite-scod\nhost: syngx\n\n"
            "Или RLM SynGX.Стоп/Старт/Перезапуск/Reload\n"
            "https://rlm.sigma.sbrf.ru/dashboard/services/restartSynGX"
        ),
        duration_minutes=5,
        executor=TEAM_MAIN,
        comment=(
            "pslsw-site00005 10.135.98.32 СЦОД\npslsw-site00006 10.135.98.134 СЦОД\n\n"
            "pvlsw-site00185 10.77.209.207 СЦОД\npvlsw-site00186 10.77.209.248 СЦОД\n"
            "pvlsw-site00187 10.77.209.201 СЦОД\npvlsw-site00188 10.77.209.231 СЦОД\n"
            "pvlsw-site00189 10.77.209.209 СЦОД\npvlsw-site00190 10.77.209.226 СЦОД\n"
            "pvlsw-site00191 10.77.209.240 СЦОД\npvlsw-site00192 10.77.209.222 СЦОД\n"
            "pvlsw-site00193 10.77.209.196 СЦОД\npvlsw-site00194 10.77.209.221 СЦОД\n"
            "pvlsw-site00195 10.77.209.230 СЦОД\npvlsw-site00196 10.77.209.211 СЦОД"
        ),
    ),
    dict(
        title=(
            'Установка приложений ФП "site" в новом проекте.\n'
            "Запуск джобы SITE_BusinessApp_parallel с параметрами:\n"
            "standName: promsite-scod\ncdpBranch: {{sprint_branch}}\nappFpName: site"
        ),
        duration_minutes=30,
        executor=TEAM_MAIN,
        comment=None,
        module_set="site",
    ),
    dict(
        title=(
            'Установка приложений ФП "sbercraft" в новом проекте.\n'
            "Запуск джобы SITE_BusinessApp_parallel с параметрами:\n"
            "standName: promsite-scod\ncdpBranch: {{sprint_branch}}\nappFpName: sbercraft"
        ),
        duration_minutes=30,
        executor=TEAM_MAIN,
        comment=None,
        module_set="sbercraft",
    ),
    dict(
        title=(
            "Выполнить установку node-page-renderer (sbercraft).\n"
            "Запуск джобы SITE_BusinessApp_parallel с параметрами:\n"
            "standName: promsite-scod\ncdpBranch: {{sprint_branch}}\nappFpName: sbercraft"
        ),
        duration_minutes=0,
        executor=TEAM_MAIN,
        comment=NODE_PAGE_RENDERER_NOTE,
    ),
    dict(
        title=(
            "Стартовать INT Syngx СЦОД\n"
            "Запуск джобы Syngx_operations с параметрами:\n"
            "operation: start\ninventory: promsite-scod\nhost: syngx_internal\n\n"
            "Или RLM SynGX.Стоп/Старт/Перезапуск/Reload\n"
            "https://rlm.sigma.sbrf.ru/dashboard/services/restartSynGX"
        ),
        duration_minutes=5,
        executor=TEAM_MAIN,
        comment="pslsw-site00005 10.135.98.32 СЦОД\npslsw-site00006 10.135.98.134 СЦОД",
    ),
    dict(
        title=(
            "Остановить INT Syngx МЦОД\n"
            "Запуск джобы Syngx_operations с параметрами:\n"
            "operation: stop\ninventory: promsite-mcod\nhost: syngx_internal\n\n"
            "Или RLM SynGX.Стоп/Старт/Перезапуск/Reload\n"
            "https://rlm.sigma.sbrf.ru/dashboard/services/restartSynGX"
        ),
        duration_minutes=5,
        executor=TEAM_MAIN,
        comment=(
            "Убедиться что остановлены именно INT Syngx, сайт в Интернете должен работать.\n"
            "pslsw-site00007 10.51.88.219 МЦОД\npslsw-site00008 10.51.88.84 МЦОД"
        ),
    ),
    dict(
        title="Проверить работоспособность обновленного плеча в Сигме",
        duration_minutes=30,
        executor=TEAM_MAIN,
        comment=DECISION_CONTINUE_NOTE,
    ),
    dict(
        title=(
            "Стартовать EXT Syngx СЦОД\n"
            "operation: start\ninventory: promsite-scod\nhost: syngx_external\n\n"
            "Или RLM SynGX.Стоп/Старт/Перезапуск/Reload\n"
            "https://rlm.sigma.sbrf.ru/dashboard/services/restartSynGX"
        ),
        duration_minutes=5,
        executor=TEAM_MAIN,
        comment=(
            "pvlsw-site00185 10.77.209.207 СЦОД\npvlsw-site00186 10.77.209.248 СЦОД\n"
            "pvlsw-site00187 10.77.209.201 СЦОД\npvlsw-site00188 10.77.209.231 СЦОД\n"
            "pvlsw-site00189 10.77.209.209 СЦОД\npvlsw-site00190 10.77.209.226 СЦОД\n"
            "pvlsw-site00191 10.77.209.240 СЦОД\npvlsw-site00192 10.77.209.222 СЦОД\n"
            "pvlsw-site00193 10.77.209.196 СЦОД\npvlsw-site00194 10.77.209.221 СЦОД\n"
            "pvlsw-site00195 10.77.209.230 СЦОД\npvlsw-site00196 10.77.209.211 СЦОД"
        ),
    ),
    dict(
        title=(
            "Остановить EXT Syngx МЦОД\n"
            "operation: stop\ninventory: promsite-mcod\nhost: syngx_external\n\n"
            "Или RLM SynGX.Стоп/Старт/Перезапуск/Reload\n"
            "https://rlm.sigma.sbrf.ru/dashboard/services/restartSynGX"
        ),
        duration_minutes=5,
        executor=TEAM_MAIN,
        comment=(
            "pvlsw-site00197 10.77.209.181 МЦОД\npvlsw-site00198 10.77.209.143 МЦОД\n"
            "pvlsw-site00199 10.77.209.141 МЦОД\npvlsw-site00200 10.77.209.135 МЦОД\n"
            "pvlsw-site00201 10.77.209.153 МЦОД\npvlsw-site00202 10.77.209.178 МЦОД\n"
            "pvlsw-site00203 10.77.209.133 МЦОД\npvlsw-site00204 10.77.209.173 МЦОД\n"
            "pvlsw-site00205 10.77.209.134 МЦОД\npvlsw-site00206 10.77.209.189 МЦОД\n"
            "pvlsw-site00207 10.77.209.164 МЦОД\npvlsw-site00208 10.77.209.159 МЦОД"
        ),
    ),
    dict(
        title=(
            "Проверить работоспособность обновленного плеча в Интернете.\n"
            "Проверить дашборды на предмет отклонений по метрикам:\n"
            "SITE_PROM_SYNGX, SITE_PROM_SERVICES, SITE_PROM_PGSE\n"
            "+ дашборды по тем приложениям, которые обновлялись в текущем релизе\n"
            "+ авторизоваться во все админки"
        ),
        duration_minutes=60,
        executor=TEAM_MAIN,
        comment=DECISION_CONTINUE_NOTE,
    ),
    dict(
        title="Написать сообщение в Сберчат о статусе работ",
        duration_minutes=5,
        executor=TEAM_MAIN,
        comment='Группа "Web-сайт - работы на промышленном стенде"',
    ),
    dict(
        title=(
            'Установка приложений ФП "site" в новом проекте.\n'
            "Запуск джобы SITE_BusinessApp_parallel с параметрами:\n"
            "standName: promsite-mcod\ncdpBranch: {{sprint_branch}}\nappFpName: site"
        ),
        duration_minutes=30,
        executor=TEAM_MAIN,
        comment=None,
        module_set="site",
    ),
    dict(
        title=(
            'Установка приложений ФП "sbercraft" в новом проекте.\n'
            "Запуск джобы SITE_BusinessApp_parallel с параметрами:\n"
            "standName: promsite-mcod\ncdpBranch: {{sprint_branch}}\nappFpName: sbercraft"
        ),
        duration_minutes=30,
        executor=TEAM_MAIN,
        comment=None,
        module_set="sbercraft",
    ),
    dict(
        title=(
            "Выполнить установку node-page-renderer (sbercraft).\n"
            "Запуск джобы SITE_BusinessApp_parallel с параметрами:\n"
            "standName: promsite-mcod\ncdpBranch: {{sprint_branch}}\nappFpName: sbercraft"
        ),
        duration_minutes=0,
        executor=TEAM_MAIN,
        comment=NODE_PAGE_RENDERER_NOTE,
    ),
    dict(
        title=(
            "Стартовать INT и EXT Syngx в МЦОД\n"
            "operation: start\ninventory: promsite-mcod\nhost: syngx\n\n"
            "Или RLM SynGX.Стоп/Старт/Перезапуск/Reload\n"
            "https://rlm.sigma.sbrf.ru/dashboard/services/restartSynGX"
        ),
        duration_minutes=5,
        executor=TEAM_MAIN,
        comment=(
            "pslsw-site00007 10.51.88.219 МЦОД\npslsw-site00008 10.51.88.84 МЦОД\n\n"
            "pvlsw-site00197 10.77.209.181 МЦОД\npvlsw-site00198 10.77.209.143 МЦОД\n"
            "pvlsw-site00199 10.77.209.141 МЦОД\npvlsw-site00200 10.77.209.135 МЦОД\n"
            "pvlsw-site00201 10.77.209.153 МЦОД\npvlsw-site00202 10.77.209.178 МЦОД\n"
            "pvlsw-site00203 10.77.209.133 МЦОД\npvlsw-site00204 10.77.209.173 МЦОД\n"
            "pvlsw-site00205 10.77.209.134 МЦОД\npvlsw-site00206 10.77.209.189 МЦОД\n"
            "pvlsw-site00207 10.77.209.164 МЦОД\npvlsw-site00208 10.77.209.159 МЦОД"
        ),
    ),
    dict(
        title="Обновить конфиги Syngx\n{{sprint_branch}}",
        duration_minutes=20,
        executor=TEAM_MAIN,
        comment=None,
    ),
    dict(
        title="Установить дашборды sbercraft\nSITE_dashboards_sbercraft c develop",
        duration_minutes=0,
        executor=TEAM_MAIN,
        comment=None,
    ),
    dict(
        title="Отключить подавление событий инфраструктурного Zabbix",
        duration_minutes=5,
        executor=TEAM_MAIN,
        comment="Отключить см.п1",
    ),
    dict(
        title="Проверка работоспособности АС",
        duration_minutes=135,
        executor=TEAM_MAIN,
        comment="Принятие решения об успешности внедрения",
    ),
    dict(
        title="Написать сообщение в Сберчат о статусе работ",
        duration_minutes=5,
        executor=TEAM_MAIN,
        comment='Группа "Web-сайт - работы на промышленном стенде"',
    ),
]

CLOSING_ITEMS = [
    dict(
        title=(
            "Публикация объявления на портале и оповещение администратора и сотрудников "
            "дежурных смен о статусе внедрения"
        ),
        duration_minutes=10,
        executor=TEAM_MAIN,
        comment=(
            'Плановые работы по ИТ-услуге "Web-сайт Сбербанка России" (CI00361662) '
            "завершены.\nУважаемые коллеги!\nПлановые работы по ИТ-услуге "
            '"Web-сайт Сбербанка России" (CI00361662) завершены.'
        ),
    ),
    dict(
        title="Merge релизных веток в master/main",
        duration_minutes=10,
        executor=TEAM_MAIN,
        comment=None,
    ),
    dict(
        title="Провести анализ внедрения в РоВ в JIRA.\nОтправить письмо на обработку релиза в ФПД",
        duration_minutes=10,
        executor=TEAM_MAIN,
        comment=None,
    ),
    dict(
        title="Сохранить лог деплоя модулей",
        duration_minutes=10,
        executor=TEAM_MAIN,
        comment=None,
    ),
    dict(
        title="Актуализировать документацию",
        duration_minutes=None,
        executor=TEAM_MAIN,
        comment=None,
    ),
]

ROLLBACK_ITEMS = [
    dict(
        title="Принятие решения об откате на предыдущую версию",
        duration_minutes=None,
        executor=TEAM_MAIN,
        comment=None,
    ),
    dict(
        title="Откат модулей подразумевает установку приложения предыдущих версий",
        duration_minutes=300,
        executor=TEAM_MAIN,
        comment=None,
    ),
    dict(
        title=(
            "Откат конфигов Syngx подразумевает возврат к состоянию до обновления:\n"
            "Запуск джобы Deploy_config_syngx_front с параметрами:\ncdpBranch: main"
        ),
        duration_minutes=60,
        executor=TEAM_MAIN,
        comment=None,
    ),
    dict(
        title="Проверка работоспособности АС",
        duration_minutes=40,
        executor=TEAM_MAIN,
        comment=None,
    ),
]

DEFAULT_ROLLBACK_NOTE = "Недоступность АС при проведении отката не планируется"

RISKS = [
    dict(
        description=(
            "Возникновение критичных ошибок в промышленной среде в процессе и после "
            "установки релиза"
        ),
        level="Низкий",
        measures=(
            "Доступность представителей разработчика и третьей линии по телефону и "
            "электронной почте во время и после проведения работ."
        ),
        owners="Отдел разработки решений маркетинга/Баландин В.А., Сусоев А.А.\nАнтоненко Р.И., Писарьков М.В.",
    ),
    dict(
        description=(
            "Возникновение критичных ошибок в контейнерной инфраструктуре Опеншифт 4 "
            "(нехватка ресурсов, ошибки в логах контейнеров на хостах Опеншифта)"
        ),
        level="Низкий",
        measures="Информирование SberInfra электронной почтой заранее о дате внедрения релиза",
        owners="Отдел облачных решений\nАнтоненко Р.И., Писарьков М.В.",
    ),
    dict(
        description=(
            "Проблемы в процессе деплоя модулей, связанные с системой контроля внедрений "
            "SORG (пример: ошибка при скачивании дистрибутива из nexus)"
        ),
        level="Низкий",
        measures="Информирование Сопровождения инструментов DevOps",
        owners="Сопровождение инструментов DevOps\nАнтоненко Р.И., Писарьков М.В.",
    ),
]

SECTIONS = [
    ("prep", PREP_ITEMS),
    ("main", MAIN_ITEMS),
    ("closing", CLOSING_ITEMS),
    ("rollback", ROLLBACK_ITEMS),
]


def seed_planned_release(release: ReleasePlan, db: Session) -> None:
    """Заполняет только что созданный Плановый релиз дефолтным набором пунктов."""
    if not release.title:
        release.title = DEFAULT_TITLE
    if not release.main_admin:
        release.main_admin = DEFAULT_MAIN_ADMIN
    if not release.second_admin:
        release.second_admin = DEFAULT_SECOND_ADMIN
    if not release.rollback_note:
        release.rollback_note = DEFAULT_ROLLBACK_NOTE

    if not release.tickets:
        for order, t in enumerate(DEFAULT_TICKETS):
            db.add(
                ReleaseTicket(
                    release_id=release.id,
                    label=t["label"],
                    key=t["key"],
                    kind=t["kind"],
                    sort_order=order,
                )
            )

    module_set_ids: dict[str, int] = {}
    if not release.module_sets:
        for order, (set_name, entries) in enumerate(MODULE_SETS.items()):
            module_set = ReleaseModuleSet(release_id=release.id, name=set_name, sort_order=order)
            db.add(module_set)
            db.flush()
            for entry_order, (name, version) in enumerate(entries):
                db.add(
                    ReleaseModuleSetEntry(
                        module_set_id=module_set.id,
                        name=name,
                        version=version,
                        sort_order=entry_order,
                    )
                )
            module_set_ids[set_name] = module_set.id

    # Индекс пункта "Проверить работоспособность обновленного плеча в Интернете" в
    # MAIN_ITEMS — план отката по факту стартует сразу после него (см. договорённость:
    # "план отката начинается в тот же день, что и основные работы... обычно после
    # этого пункта"), а не как отдельная независимая точка отсчёта.
    ROLLBACK_ANCHOR_MAIN_INDEX = 11

    main_items_by_index: dict[int, ReleaseItem] = {}
    for section, items in SECTIONS:
        previous: ReleaseItem | None = None
        if section == "closing" and main_items_by_index:
            # Заключительные работы начинаются сразу по завершении основных —
            # без отдельного ручного "начала раздела".
            previous = main_items_by_index[len(MAIN_ITEMS) - 1]
        elif section == "rollback" and main_items_by_index:
            previous = main_items_by_index.get(ROLLBACK_ANCHOR_MAIN_INDEX)

        for order, data in enumerate(items):
            item = ReleaseItem(
                release_id=release.id,
                section=section,
                item_type="work",
                title=data["title"],
                duration_minutes=data.get("duration_minutes"),
                executor=data.get("executor"),
                comment=data.get("comment"),
                module_set_id=module_set_ids.get(data.get("module_set")),
                sort_order=order,
            )
            db.add(item)
            db.flush()
            if previous is not None:
                item.depends_on_id = previous.id
            if section == "main":
                main_items_by_index[order] = item
            previous = item

    for order, r in enumerate(RISKS):
        db.add(
            ReleaseRisk(
                release_id=release.id,
                description=r["description"],
                level=r.get("level"),
                measures=r.get("measures"),
                owners=r.get("owners"),
                sort_order=order,
            )
        )
