from sqlmodel import SQLModel, Field, Relationship
from typing import Optional
import datetime
from utils.procedures import generate_random_string


class Automation(SQLModel, table=True):
    __tablename__ = "automations"

    id: Optional[str] = Field(primary_key=True, index=True, nullable=False, default_factory=lambda: generate_random_string(10))
    user_id: str = Field(foreign_key="users.id", nullable=False)
    name: str = Field(nullable=False)
    login_url: str = Field(nullable=False)
    username: Optional[str] = Field(nullable=True)
    password: Optional[str] = Field(nullable=True)
    description: Optional[str] = Field(nullable=True)
    logo: Optional[str] = Field(nullable=True)
    
    created_at: Optional[datetime.datetime] = Field(default_factory=datetime.datetime.now)
    updated_at: Optional[datetime.datetime] = Field(default_factory=datetime.datetime.now,
                                                    sa_column_kwargs={'onupdate': datetime.datetime.now})

    # Relationships
    user: Optional["User"] = Relationship(back_populates="automations")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "login_url": self.login_url,
            "username": self.username,
            "password": self.password,
            "description": self.description,
            "logo": self.logo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
