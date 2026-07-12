from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    jira_base_url: str = ""
    jira_username: str = ""
    jira_password: str = ""
    jira_jql: str = "assignee = currentUser() ORDER BY updated DESC"

    database_url: str = "sqlite:///./work_assistant.db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
