from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select, and_, update
from dependencies.auth_dependencies import get_current_user_dependency
from db.database import get_session
from db.models import (User, Thread, ThreadStatus, ThreadTask, ThreadMessage, ThreadChatType, ThreadChatFromChoices,
                       ThreadTaskStatus, ThreadTaskPlan, ThreadTaskPlanStatus, PlanSubtask, SubtaskStatus, UserPlan)
from schemas.threads import ListThread, CreateThread, UpdateThread, ListThreadMessage, RetrieveThread, SendMessageObj
from typing import List
from utils.procedures import CustomError, extract_json
from utils import ai_helpers
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from utils import ai_prompts, llm_provider
import datetime
import json


router = APIRouter(
    prefix='/apps/threads',
    tags=['apps', 'threads'],
    dependencies=[Depends(get_current_user_dependency)]
)


def reconcile_orphan_threads(db: Session, user_id: str) -> None:
    """
    Detect and clean up zombie threads/tasks for a given user.

    A "zombie" is a thread left in WORKING status with no recent DESKTOP_USE
    activity. This typically happens when the desktop agent process crashes
    or the app is killed abruptly.

    - Tasks with no DESKTOP_USE message for 120s are marked CANCELED
    - The corresponding thread is marked STANDBY
    - Any thread left in WORKING with NO working task is also cleaned up
    """
    working_threads = db.exec(
        select(Thread).where(and_(
            Thread.user_id == user_id,
            Thread.status == ThreadStatus.WORKING
        ))
    ).all()

    now = datetime.datetime.utcnow()

    for thread in working_threads:
        # Get ALL tasks in this thread (any status)
        all_tasks = db.exec(
            select(ThreadTask).where(ThreadTask.thread_id == thread.id)
        ).all()

        # Get only the WORKING task
        active_task = db.exec(
            select(ThreadTask).where(and_(
                ThreadTask.thread_id == thread.id,
                ThreadTask.status == ThreadTaskStatus.WORKING
            ))
        ).first()

        # If thread is WORKING but has no working task -> clean up
        if not active_task:
            thread.status = ThreadStatus.STANDBY
            thread.updated_at = now
            db.add(thread)
            continue

        # If thread has no messages at all and is older than 10s -> clean up
        any_message = db.exec(
            select(ThreadMessage).where(ThreadMessage.thread_id == thread.id).limit(1)
        ).first()
        if not any_message and active_task.created_at and (now - active_task.created_at).total_seconds() > 10:
            active_task.status = ThreadTaskStatus.CANCELED
            active_task.updated_at = now
            db.add(active_task)
            thread.status = ThreadStatus.STANDBY
            thread.updated_at = now
            db.add(thread)
            continue

        # Check for any recent DESKTOP_USE activity
        last_desktop_message = db.exec(
            select(ThreadMessage)
            .where(and_(
                ThreadMessage.thread_id == thread.id,
                ThreadMessage.thread_task_id == active_task.id,
                ThreadMessage.thread_chat_type == ThreadChatType.DESKTOP_USE,
            ))
            .order_by(ThreadMessage.created_at.desc())
            .limit(1)
        ).first()

        is_orphan = False
        if not last_desktop_message:
            # No desktop activity ever - orphan after 10s grace
            if active_task.created_at and (now - active_task.created_at).total_seconds() > 10:
                is_orphan = True
        else:
            # Has desktop activity but stale for more than 120s
            if (now - last_desktop_message.created_at).total_seconds() > 120:
                is_orphan = True

        if is_orphan:
            active_task.status = ThreadTaskStatus.CANCELED
            active_task.updated_at = now
            db.add(active_task)

            thread.status = ThreadStatus.STANDBY
            thread.updated_at = now
            db.add(thread)

    db.commit()


@router.get('', response_model=List[ListThread])
def list_threads(db: Session = Depends(get_session), user: User = Depends(get_current_user_dependency)):
    # Clean up any orphan/zombie threads before listing
    reconcile_orphan_threads(db, user.id)

    query = select(Thread).where(and_(
        Thread.user_id == user.id,
        Thread.status != ThreadStatus.DELETED
    )).order_by(Thread.created_at.desc())
    return db.exec(query)


@router.post('')
def create_thread(create_thread_obj: CreateThread, db: Session = Depends(get_session),
                  user: User = Depends(get_current_user_dependency)):

    # Clean up any orphan/zombie threads before checking for conflicts
    reconcile_orphan_threads(db, user.id)

    working_threads = db.exec(select(Thread).where(and_(
        Thread.user_id == user.id,
        Thread.status == ThreadStatus.WORKING
    )))
    if len(working_threads.all()) > 0:
        raise CustomError(status.HTTP_400_BAD_REQUEST, 'Running_Thread')

    # Vérifier si l'utilisateur est sur le free plan
    # Pour le free plan, la vérification des minutes est gérée par le frontend (electron-store)
    # Pour les plans payants, Supabase gère les données
    user_plan = db.exec(select(UserPlan).where(and_(
        UserPlan.user_id == user.id,
        UserPlan.is_active == True
    )).order_by(UserPlan.created_at.desc())).first()
    
    # Les plans payants (starter, semester, annual) n'ont pas de limite
    # Le free plan est géré par electron-store dans le frontend

    llm = llm_provider.get_llm(agent='classifier', temperature=0.1)

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

    # Build user message with previous tasks context
    user_message = f"Previous Tasks (Limited to 10): \n {json.dumps(previous_tasks_arr)} \n\nTask: {create_thread_obj.task}"

    # Check if llm is ChatOpenAI (DeepSeek) for proper format
    if isinstance(llm, ChatOpenAI):
        # DeepSeek format - build messages directly
        messages = [
            {"role": "system", "content": ai_prompts.CLASSIFIER_AGENT_PROMPT},
            {"role": "user", "content": user_message}
        ]
        response = llm.invoke(messages)
    else:
        # Fallback for other models
        prompt = ChatPromptTemplate.from_messages([
            ('system', ai_prompts.CLASSIFIER_AGENT_PROMPT),
            HumanMessage(f'Previous Tasks (Limited to 10): \n {json.dumps(previous_tasks_arr)}'),
            ('user', create_thread_obj.task),
        ])
        chain = prompt | llm
        response = chain.invoke({})

    response_data = extract_json(response.content)

    if response_data.get('type') == 'desktop_task':
        if create_thread_obj.background_mode is True or response_data.get('is_background_mode_requested', False) is True:
            if response_data.get('is_browser_task') is False:
                raise CustomError(status.HTTP_400_BAD_REQUEST, 'Not_Browser_Task_BG_Mode')

    instance = Thread(
        title=ai_helpers.generate_thread_title(create_thread_obj.task),
        user_id=user.id,
        current_task=create_thread_obj.task,
    )
    db.add(instance)
    db.commit()
    db.refresh(instance)

    user_message = ThreadMessage(
        thread_id=instance.id,
        thread_chat_type=ThreadChatType.NORMAL_MESSAGE,
        thread_chat_from=ThreadChatFromChoices.FROM_USER,
        text=create_thread_obj.task,
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    response_data['thread_id'] = instance.id

    if response_data.get('type') == 'desktop_task':
        thread_task = ThreadTask(
            thread_id=instance.id,
            task_text=create_thread_obj.task,
            needs_memory_from_previous_tasks=response_data.get('needs_memory_from_previous_tasks', False),
            background_mode=create_thread_obj.background_mode or response_data.get('is_background_mode_requested', False),
            extended_thinking_mode=create_thread_obj.extended_thinking_mode or response_data.get('is_extended_thinking_mode_requested', False),
        )
        db.add(thread_task)
        db.commit()
        db.refresh(thread_task)

        ai_message = ThreadMessage(
            thread_id=instance.id,
            thread_chat_type=ThreadChatType.CLASSIFICATION,
            thread_chat_from=ThreadChatFromChoices.FROM_AI,
            text=json.dumps(response_data),
        )
        db.add(ai_message)
        db.commit()
        db.refresh(ai_message)

        instance.status = ThreadStatus.WORKING
        db.add(instance)
        db.commit()
        db.refresh(instance)

        return response_data
    else:
        ai_message = ThreadMessage(
            thread_id=instance.id,
            thread_chat_type=ThreadChatType.CLASSIFICATION,
            thread_chat_from=ThreadChatFromChoices.FROM_AI,
            text=json.dumps(response_data),
        )
        db.add(ai_message)
        db.commit()
        db.refresh(ai_message)

        return response_data


@router.put('/{tid}')
def update_thread(tid: str, update_obj: UpdateThread, db: Session = Depends(get_session), user: User = Depends(get_current_user_dependency)):
    instance = db.exec(select(Thread).where(and_(
        Thread.id == tid,
        Thread.user_id == user.id,
        Thread.status != ThreadStatus.DELETED
    ))).first()

    if not instance:
        raise CustomError(status.HTTP_404_NOT_FOUND, 'Thread not found')

    instance.title = update_obj.title
    db.add(instance)
    db.commit()
    db.refresh(instance)

    return {'message': 'Success'}


@router.delete('/{tid}')
def delete_thread(tid: str, db: Session = Depends(get_session), user: User = Depends(get_current_user_dependency)):
    instance = db.exec(select(Thread).where(and_(
        Thread.id == tid,
        Thread.user_id == user.id,
        Thread.status != ThreadStatus.DELETED
    ))).first()

    if not instance:
        raise CustomError(status.HTTP_404_NOT_FOUND, 'Thread not found')

    if instance.status == ThreadStatus.WORKING:
        raise CustomError(status.HTTP_400_BAD_REQUEST, 'Cannot_Delete_Working_Thread')

    instance.status = ThreadStatus.DELETED
    db.add(instance)
    db.commit()
    db.refresh(instance)

    return {'message': 'Success'}


@router.get('/{tid}', response_model=RetrieveThread)
def retrieve_thread(tid: str, db: Session = Depends(get_session), user: User = Depends(get_current_user_dependency)):
    instance = db.exec(select(Thread).where(and_(
        Thread.id == tid,
        Thread.user_id == user.id,
        Thread.status != ThreadStatus.DELETED
    ))).first()

    if not instance:
        raise CustomError(status.HTTP_404_NOT_FOUND, 'Thread not found')

    # Calculer le status de la task en cours
    working_task = db.exec(select(ThreadTask).where(and_(
        ThreadTask.thread_id == tid,
        ThreadTask.status == ThreadTaskStatus.WORKING
    ))).first()

    # Ajouter le status de la task en cours à l'instance
    if working_task:
        instance.current_task_status = working_task.status.value if hasattr(working_task.status, 'value') else str(working_task.status)
    else:
        # Pas de task working, prendre la dernière task
        last_task = db.exec(select(ThreadTask).where(
            ThreadTask.thread_id == tid
        ).order_by(ThreadTask.created_at.desc())).first()
        if last_task:
            instance.current_task_status = last_task.status.value if hasattr(last_task.status, 'value') else str(last_task.status)

    return instance


@router.get('/{tid}/thread_messages', response_model=List[ListThreadMessage])
def thread_messages(tid: str, db: Session = Depends(get_session), user: User = Depends(get_current_user_dependency)):
    query = select(ThreadMessage).where(and_(
        ThreadMessage.thread_id == tid,
        ThreadMessage.thread.has(Thread.user_id == user.id),
    )).order_by(ThreadMessage.created_at.asc())
    return db.exec(query)


@router.post('/cancel_all_running_tasks')
def cancel_all_running_tasks(db: Session = Depends(get_session), user: User = Depends(get_current_user_dependency)):
    db.exec(update(Thread).where(Thread.status == ThreadStatus.WORKING).values(
        status=ThreadStatus.STANDBY,
    ))

    db.exec(update(ThreadTask).where(ThreadTask.status == ThreadTaskStatus.WORKING).values(
        status=ThreadTaskStatus.CANCELED,
    ))

    db.exec(update(ThreadTaskPlan).where(ThreadTaskPlan.status == ThreadTaskPlanStatus.ACTIVE).values(
        status=ThreadTaskPlanStatus.CANCELED,
    ))

    db.exec(update(PlanSubtask).where(PlanSubtask.status == SubtaskStatus.ACTIVE).values(
        status=SubtaskStatus.CANCELED,
    ))

    db.commit()

    return {'message': 'Success'}


@router.post('/{tid}/cancel_task')
def cancel_running_task(tid: str, db: Session = Depends(get_session), user: User = Depends(get_current_user_dependency)):
    instance = db.exec(select(Thread).where(and_(
        Thread.id == tid,
        Thread.user_id == user.id,
        Thread.status != ThreadStatus.DELETED
    ))).first()

    if not instance:
        raise CustomError(status.HTTP_404_NOT_FOUND, 'Thread not found')

    if instance.status != ThreadStatus.WORKING:
        raise CustomError(status.HTTP_400_BAD_REQUEST, 'Not_Running')

    instance.status = ThreadStatus.STANDBY
    db.add(instance)
    db.commit()
    db.refresh(instance)

    running_task = db.exec(select(ThreadTask).where(and_(
        ThreadTask.thread_id == tid,
        ThreadTask.status == ThreadTaskStatus.WORKING
    ))).first()

    if running_task:
        running_task.status = ThreadTaskStatus.CANCELED
        db.add(running_task)
        db.commit()
        db.refresh(running_task)

        db.exec(update(ThreadTaskPlan).where(ThreadTaskPlan.thread_task_id == running_task.id).values(
            status=ThreadTaskPlanStatus.CANCELED,
        ))

        db.exec(update(PlanSubtask).where(PlanSubtask.plan.has(ThreadTaskPlan.thread_task_id == running_task.id)).values(
            status=SubtaskStatus.CANCELED,
        ))

    ai_message = ThreadMessage(
        thread_id=instance.id,
        thread_task_id=running_task.id,
        thread_chat_type=ThreadChatType.DESKTOP_USE,
        thread_chat_from=ThreadChatFromChoices.FROM_AI,
        text=json.dumps({'actions': [{'action': 'task_canceled'}]}),
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    return {'message': 'Success'}


@router.post('/{tid}/send_message')
def send_message(tid: str, obj: SendMessageObj, db: Session = Depends(get_session),
                 user: User = Depends(get_current_user_dependency)):
    instance = db.exec(select(Thread).where(and_(
        Thread.id == tid,
        Thread.user_id == user.id,
        Thread.status != ThreadStatus.DELETED
    ))).first()

    if not instance:
        raise CustomError(status.HTTP_404_NOT_FOUND, 'Thread not found')

    # Nettoyer les zombies avant de vérifier l'état du thread
    reconcile_orphan_threads(db, user.id)

    # Vérifier si l'utilisateur est sur le free plan
    # Pour le free plan, la vérification des minutes est gérée par le frontend (electron-store)
    # Pour les plans payants, Supabase gère les données
    user_plan = db.exec(select(UserPlan).where(and_(
        UserPlan.user_id == user.id,
        UserPlan.is_active == True
    )).order_by(UserPlan.created_at.desc())).first()
    
    # Les plans payants (starter, semester, annual) n'ont pas de limite
    # Le free plan est géré par electron-store dans le frontend

    working_threads = db.exec(select(Thread).where(and_(
        Thread.user_id == user.id,
        Thread.status == ThreadStatus.WORKING
    )))
    if len(working_threads.all()) > 0:
        raise CustomError(status.HTTP_400_BAD_REQUEST, 'Running_Thread')

    llm = llm_provider.get_llm(agent='classifier', temperature=0.1)

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

    prompt = ChatPromptTemplate.from_messages([
        ('system', ai_prompts.CLASSIFIER_AGENT_PROMPT),
        HumanMessage(f'Previous Tasks (Limited to 10): \n {json.dumps(previous_tasks_arr)}'),
        ('user', obj.text),
    ])

    chain = prompt | llm

    response = chain.invoke({})
    response_data = extract_json(response.content)

    if response_data.get('type') == 'desktop_task':
        if obj.background_mode is True or response_data.get('is_background_mode_requested', False) is True:
            if response_data.get('is_browser_task') is False:
                raise CustomError(status.HTTP_400_BAD_REQUEST, 'Not_Browser_Task_BG_Mode')

    user_message = ThreadMessage(
        thread_id=instance.id,
        thread_chat_type=ThreadChatType.NORMAL_MESSAGE,
        thread_chat_from=ThreadChatFromChoices.FROM_USER,
        text=obj.text,
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    if response_data.get('type') == 'desktop_task':
        thread_task = ThreadTask(
            thread_id=instance.id,
            task_text=obj.text,
            needs_memory_from_previous_tasks=response_data.get('needs_memory_from_previous_tasks', False),
            background_mode=obj.background_mode or response_data.get('is_background_mode_requested', False),
            extended_thinking_mode=obj.extended_thinking_mode or response_data.get('is_extended_thinking_mode_requested', False),
        )
        db.add(thread_task)
        db.commit()
        db.refresh(thread_task)

        ai_message = ThreadMessage(
            thread_id=instance.id,
            thread_chat_type=ThreadChatType.CLASSIFICATION,
            thread_chat_from=ThreadChatFromChoices.FROM_AI,
            text=json.dumps(response_data),
        )
        db.add(ai_message)
        db.commit()
        db.refresh(ai_message)

        instance.status = ThreadStatus.WORKING
        db.add(instance)
        db.commit()
        db.refresh(instance)

        return response_data
    else:
        ai_message = ThreadMessage(
            thread_id=instance.id,
            thread_chat_type=ThreadChatType.CLASSIFICATION,
            thread_chat_from=ThreadChatFromChoices.FROM_AI,
            text=json.dumps(response_data),
        )
        db.add(ai_message)
        db.commit()
        db.refresh(ai_message)

        return response_data