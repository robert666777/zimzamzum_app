from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select, and_
from db.database import get_session
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
import json
import datetime
from utils import ai_prompts
from utils.procedures import CustomError, extract_json
from dependencies.auth_dependencies import get_current_user_dependency
from db.models import (User, Thread, ThreadStatus, ThreadTask, ThreadTaskStatus, ThreadMessage,
                       ThreadChatType, ThreadChatFromChoices, ThreadTaskMemoryEntry, UserPlan)
from schemas.aiagent import BackgroundNextStepRequest
from utils.agentic_tools import run_tool_server_side
from utils import llm_provider
from base64 import b64decode
import io
import os
from utils import upload_helper


router = APIRouter(
    prefix='/aiagent/background',
    tags=['aiagent', 'background'],
    dependencies=[Depends(get_current_user_dependency)]
)


@router.post('/{tid}/next_step')
def next_step(tid: str, next_step_req: BackgroundNextStepRequest, db: Session = Depends(get_session),
              user: User = Depends(get_current_user_dependency)):
    instance = db.exec(select(Thread).where(and_(
        Thread.id == tid,
        Thread.user_id == user.id,
        Thread.status == ThreadStatus.WORKING
    ))).first()

    if not instance:
        raise CustomError(status.HTTP_404_NOT_FOUND, 'Thread not found')

    task = db.exec(select(ThreadTask).where(and_(
        ThreadTask.thread_id == tid,
        ThreadTask.status == ThreadTaskStatus.WORKING,
    ))).first()

    if not task:
        raise CustomError(status.HTTP_404_NOT_FOUND, 'Thread has no running task')

    if task.extended_thinking_mode is True:
        llm = llm_provider.get_llm(agent='computer_use', temperature=1.0, thinking_enabled=True)
    else:
        llm = llm_provider.get_llm(agent='computer_use', temperature=0.0)

    previous_tasks = db.exec(select(ThreadTask).where(and_(
        ThreadTask.thread.has(Thread.user_id == user.id),
        ThreadTask.thread.has(Thread.status != ThreadStatus.DELETED),
    )).order_by(ThreadTask.created_at.desc()).limit(10)).all()
    previous_tasks_arr = []
    for previous_task in previous_tasks:
        previous_tasks_arr.append({
            'task': previous_task.task_text,
            'status': previous_task.status,
        })

    screenshot_user_message_block = None
    screenshot_s3_path = None
    if next_step_req.screenshot_b64:
        if os.getenv('ENABLE_SCREENSHOT_LOGGING_FOR_TRAINING') == 'true':
            image_bytes = b64decode(next_step_req.screenshot_b64)
            image_io = io.BytesIO(image_bytes)
            screenshot_s3_path = upload_helper.upload_screenshot_s3_bytesio(image_io, extension="png")
        
        screenshot_user_message_block = {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": next_step_req.screenshot_b64
            }
        }

    action_history = []
    task_previous_messages = db.exec(
        select(ThreadMessage)
        .where(
            and_(
                ThreadMessage.thread_task_id == task.id,
                ThreadMessage.thread_chat_type == ThreadChatType.BACKGROUND_MODE_BROWSER,
            )
        )
        .order_by(ThreadMessage.created_at.desc())  # Adjust if your timestamp column is named differently
        .limit(5)
    ).all()
    for previous_message in task_previous_messages:
        previous_action_dict = json.loads(previous_message.text)
        # previous_action_dict.pop("current_state", None)
        action_history.append(previous_action_dict)

    if task.needs_memory_from_previous_tasks is True:
        tasks_for_memory = db.exec(select(ThreadTask).where(and_(
            ThreadTask.thread.has(Thread.user_id == user.id),
            ThreadTask.thread.has(Thread.status != ThreadStatus.DELETED),
        )).order_by(ThreadTask.created_at.desc()).limit(5)).all()
        tasks_for_memory_ids = [task.id for task in tasks_for_memory]
        memory_items = db.exec(
            select(ThreadTaskMemoryEntry).where(
                ThreadTaskMemoryEntry.thread_task_id.in_(tasks_for_memory_ids)
            )
        ).all()
    else:
        memory_items = db.exec(select(ThreadTaskMemoryEntry).where(
            ThreadTaskMemoryEntry.thread_task_id == task.id
        )).all()

    memory_items_arr = []
    for memory_item in memory_items:
        memory_items_arr.append({
            'memory_item_text': memory_item.text,
        })

    # Build the user message as a single text string for DeepSeek compatibility
    computer_use_user_message_text = f"""Current Task: {task.task_text}

Current URL: {next_step_req.current_url}

Current Open Tabs: {json.dumps(next_step_req.current_open_tabs)}"""

    if len(memory_items_arr) > 0:
        computer_use_user_message_text += f"""

Stored Memory Items:
{json.dumps(memory_items_arr)}"""
    if len(action_history) > 0:
        computer_use_user_message_text += f"""

Previous Actions (Limited to 5, newest first):
{json.dumps(action_history)}"""
    if len(previous_tasks_arr) > 0:
        computer_use_user_message_text += f"""

Previous Tasks:
{json.dumps(previous_tasks_arr)}"""
    
    computer_use_text_prompt = computer_use_user_message_text
    
    # Check if llm is ChatOpenAI
    if isinstance(llm, ChatOpenAI):
        # Check if it's DeepSeek by looking at base_url
        llm_base_url = getattr(llm, 'base_url', None)
        if not llm_base_url and hasattr(llm, '_client'):
            llm_base_url = str(getattr(llm._client, '_api_url', '')).lower()
        
        is_deepseek = llm_base_url and 'deepseek' in str(llm_base_url).lower()
        
        if is_deepseek:
            # DeepSeek - text only, no vision support
            messages = [
                {"role": "system", "content": ai_prompts.BG_MODE_BROWSER_AGENT_PROMPT},
                {"role": "user", "content": computer_use_user_message_text}
            ]
            response = llm.invoke(messages)
        else:
            # Kimi or other ChatOpenAI models - supports vision
            if screenshot_user_message_block:
                computer_use_user_message = [
                    {
                        'type': 'text',
                        'text': computer_use_user_message_text
                    },
                    screenshot_user_message_block
                ]
            else:
                computer_use_user_message = computer_use_user_message_text

            prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=ai_prompts.BG_MODE_BROWSER_AGENT_PROMPT),
            HumanMessage(content=computer_use_user_message),
        ])

        chain = prompt | llm
        response = chain.invoke({})

    # Print token usage if available (DeepSeek format)
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        print('Token Usage: ', response.usage_metadata)
    elif hasattr(response, 'usage') and response.usage:
        print('Token Usage: ', response.usage)

    response_data = None
    
    # Handle both DeepSeek and Kimi response formats
    response_content = response.content
    
    # DeepSeek returns a string, Kimi returns a list
    if isinstance(response_content, list):
        # Kimi format with thinking mode
        if task.extended_thinking_mode is True:
            for response_item in response_content:
                if response_item.get('type') == 'reasoning_content':
                    thinking_message = ThreadMessage(
                        thread_id=instance.id,
                        thread_task_id=task.id,
                        thread_chat_type=ThreadChatType.THINKING,
                        thread_chat_from=ThreadChatFromChoices.FROM_AI,
                        chain_of_thought=response_item.get('reasoning_content', {}).get('text'),
                    )
                    db.add(thinking_message)
                    db.commit()
                    db.refresh(thinking_message)
                elif response_item.get('type') == 'text':
                    response_data = extract_json(response_item.get('text'))
        else:
            # Try to find the text content in the list
            for response_item in response_content:
                if response_item.get('type') == 'text':
                    response_data = extract_json(response_item.get('text'))
                    break
            if not response_data:
                response_data = extract_json(str(response_content))
    else:
        # DeepSeek format - string response
        response_data = extract_json(response_content)

    ai_message = ThreadMessage(
        thread_id=instance.id,
        thread_task_id=task.id,
        thread_chat_type=ThreadChatType.BACKGROUND_MODE_BROWSER,
        thread_chat_from=ThreadChatFromChoices.FROM_AI,
        screenshot=screenshot_s3_path,
        prompt=json.dumps(computer_use_text_prompt),
        text=json.dumps(response_data),
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    if response_data.get('current_state', {}).get('save_to_memory', False):
        memory_text = response_data['current_state'].get('memory')
        if memory_text:
            memory_entry = ThreadTaskMemoryEntry(
                thread_task_id=task.id,
                text=memory_text,
            )
            db.add(memory_entry)
            db.commit()
            db.refresh(memory_entry)

    # Iterate over all actions
    actions_arr = response_data.get('actions', [])
    for act in actions_arr:
        action_type = act.get('action')

        if action_type == 'task_completed' and len(actions_arr) == 1:
            task.status = ThreadTaskStatus.COMPLETED
            
            # Calculer la durée de la tâche
            if task.created_at:
                duration = datetime.datetime.now() - task.created_at
                task.duration_minutes = duration.total_seconds() / 60
            db.add(task)
            db.commit()
            db.refresh(task)

            instance.status = ThreadStatus.STANDBY
            db.add(instance)
            db.commit()
            db.refresh(instance)

            # ai_message = ThreadMessage(
            #     thread_id=instance.id,
            #     thread_task_id=task.id,
            #     thread_chat_type=ThreadChatType.BACKGROUND_MODE_BROWSER,
            #     thread_chat_from=ThreadChatFromChoices.FROM_AI,
            #     text=json.dumps({'actions': [{'action': 'task_completed'}]}),
            # )
            # db.add(ai_message)
            # db.commit()
            # db.refresh(ai_message)

        elif action_type == 'task_failed':
            task.status = ThreadTaskStatus.FAILED
            
            # Calculer la durée de la tâche
            if task.created_at:
                duration = datetime.datetime.now() - task.created_at
                task.duration_minutes = duration.total_seconds() / 60
            db.add(task)
            db.commit()
            db.refresh(task)

            instance.status = ThreadStatus.STANDBY
            db.add(instance)
            db.commit()
            db.refresh(instance)

            # ai_message = ThreadMessage(
            #     thread_id=instance.id,
            #     thread_task_id=task.id,
            #     thread_chat_type=ThreadChatType.BACKGROUND_MODE_BROWSER,
            #     thread_chat_from=ThreadChatFromChoices.FROM_AI,
            #     text=json.dumps({'actions': [{'action': 'task_failed'}]}),
            # )
            # db.add(ai_message)
            # db.commit()
            # db.refresh(ai_message)

        elif action_type == 'tool_use':
            tool = act['params'].get('tool')
            args = act['params'].get('args', {})

            if tool == 'save_to_memory':
                memory_entry = ThreadTaskMemoryEntry(
                    thread_task_id=task.id,
                    text=args.get('text', ''),
                )
                db.add(memory_entry)
                db.commit()
                db.refresh(memory_entry)

            elif tool in ['read_pdf', 'fetch_url', 'summarize_youtube_video']:
                tool_output_text = run_tool_server_side(tool, args)
                memory_entry = ThreadTaskMemoryEntry(
                    thread_task_id=task.id,
                    text=tool_output_text,
                )
                db.add(memory_entry)
                db.commit()
                db.refresh(memory_entry)

    return response_data
