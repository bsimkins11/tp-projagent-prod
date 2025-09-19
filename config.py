"""Configuration settings for the GCP Drive-Custom GPT middleware."""

import os
from typing import Optional
from pydantic import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # GCP Configuration
    google_application_credentials: str = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    gcp_project_id: str = os.getenv("GCP_PROJECT_ID", "")
    
    # Google Workspace Configuration
    google_workspace_domain: str = os.getenv("GOOGLE_WORKSPACE_DOMAIN", "")
    google_drive_folder_id: str = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")
    
    # Custom GPT Configuration
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    custom_gpt_id: str = os.getenv("CUSTOM_GPT_ID", "")
    
    # Server Configuration
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    debug: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
