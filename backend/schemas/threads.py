import datetime
from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional, List


class ListThreadTask(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    task_text: str
    created_at: Optional[datetime.datetime]


class RetrieveThread(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    status: str
    created_at: Optional[datetime.datetime]
    thread_tasks: List[ListThreadTask]
    current_task_status: Optional[str] = None  # Status de la task en cours (working, completed, failed, etc)


class ListThread(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    status: str
    created_at: Optional[datetime.datetime]


class CreateThread(BaseModel):
    task: str
    background_mode: Optional[bool] = False
    extended_thinking_mode: Optional[bool] = False


class UpdateThread(BaseModel):
    title: str


class ListThreadTask(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    task_text: str


class ListThreadMessage(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    thread_task: Optional[ListThreadTask]
    thread_chat_type: str
    thread_chat_from: str
    text: Optional[str]
    chain_of_thought: Optional[str]
    created_at: Optional[datetime.datetime]


class SendMessageObj(BaseModel):
    text: str
    background_mode: Optional[bool] = False
    extended_thinking_mode: Optional[bool] = False
