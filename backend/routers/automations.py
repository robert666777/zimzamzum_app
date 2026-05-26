from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from models.automation import Automation
from db.database import get_session
from db.models import User
from typing import List
from dependencies.auth_dependencies import get_current_user_dependency

automations_router = APIRouter(
    prefix='/automations',
    tags=['automations'],
    dependencies=[Depends(get_current_user_dependency)],
)

# Default platforms data
DEFAULT_PLATFORMS = [
    {
        'id': 'chaoxing',
        'name': 'Chaoxing / 学习通',
        'login_url': 'https://passport2.chaoxing.com/login',
        'description': 'Phone, email, school account + student ID, or QR code via app',
        'logo': 'C'
    },
    {
        'id': 'zhihuishu',
        'name': 'Zhihuishu / 智慧树',
        'login_url': 'https://passport.zhihuishu.com/login',
        'description': 'Official login page for Zhidao platform',
        'logo': 'Z'
    },
    {
        'id': 'yuketang',
        'name': 'Yuketang / 雨课堂',
        'login_url': 'https://www.yuketang.cn/web',
        'description': 'Yuketang platform login',
        'logo': 'Y'
    },
    {
        'id': 'icourse',
        'name': 'iCourse / 中国大学MOOC',
        'login_url': 'https://www.icourse163.org/',
        'description': 'Phone, email, iCourse account, or QR code via app',
        'logo': 'i'
    },
    {
        'id': 'xuetangx',
        'name': 'XuetangX / 学堂在线',
        'login_url': 'https://www.xuetangx.com/',
        'description': 'Phone, email, or WeChat scan. Student number login for credit courses',
        'logo': 'X'
    }
]


@automations_router.get('/platforms', response_model=List[dict])
async def get_platforms(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user_dependency),
):
    """Get all platforms for the current user"""
    try:
        statement = select(Automation).where(Automation.user_id == user.id)
        user_platforms = session.exec(statement).all()

        platforms = []

        for default in DEFAULT_PLATFORMS:
            platforms.append({
                **default,
                'username': None,
                'password': None
            })

        for platform in user_platforms:
            platforms.append(platform.to_dict())

        return platforms

    except Exception as e:
        print(f'Error getting platforms: {e}')
        return [{
            **d,
            'username': None,
            'password': None
        } for d in DEFAULT_PLATFORMS]


@automations_router.post('/platforms', response_model=dict)
async def create_platform(
    platform_data: dict,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user_dependency),
):
    """Create a new platform for the current user"""
    try:
        if not platform_data.get('name') or not platform_data.get('login_url'):
            raise HTTPException(status_code=400, detail='Name and login_url are required')

        platform_id = platform_data['name'].lower().replace(' ', '-')

        statement = select(Automation).where(
            Automation.user_id == user.id,
            Automation.id == platform_id
        )
        existing = session.exec(statement).first()

        if existing:
            raise HTTPException(status_code=400, detail='Platform already exists')

        platform = Automation(
            id=platform_id,
            user_id=user.id,
            name=platform_data['name'],
            login_url=platform_data['login_url'],
            username=platform_data.get('username'),
            password=platform_data.get('password'),
            description=platform_data.get('description'),
            logo=platform_data.get('logo', platform_data['name'][0].upper())
        )

        session.add(platform)
        session.commit()
        session.refresh(platform)

        return platform.to_dict()

    except HTTPException:
        raise
    except Exception as e:
        print(f'Error creating platform: {e}')
        raise HTTPException(status_code=500, detail='Failed to create platform')


@automations_router.put('/platforms/{platform_id}', response_model=dict)
async def update_platform(
    platform_id: str,
    platform_data: dict,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user_dependency),
):
    """Update a platform for the current user"""
    try:
        statement = select(Automation).where(
            Automation.user_id == user.id,
            Automation.id == platform_id
        )
        platform = session.exec(statement).first()

        if not platform:
            raise HTTPException(status_code=404, detail='Platform not found')

        if platform_data.get('name'):
            platform.name = platform_data['name']
        if platform_data.get('login_url'):
            platform.login_url = platform_data['login_url']
        if platform_data.get('username') is not None:
            platform.username = platform_data['username']
        if platform_data.get('password') is not None:
            platform.password = platform_data['password']
        if platform_data.get('description') is not None:
            platform.description = platform_data['description']
        if platform_data.get('logo') is not None:
            platform.logo = platform_data['logo']

        session.commit()
        session.refresh(platform)

        return platform.to_dict()

    except HTTPException:
        raise
    except Exception as e:
        print(f'Error updating platform: {e}')
        raise HTTPException(status_code=500, detail='Failed to update platform')


@automations_router.delete('/platforms/{platform_id}')
async def delete_platform(
    platform_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user_dependency),
):
    """Delete a platform for the current user"""
    try:
        statement = select(Automation).where(
            Automation.user_id == user.id,
            Automation.id == platform_id
        )
        platform = session.exec(statement).first()

        if not platform:
            raise HTTPException(status_code=404, detail='Platform not found')

        session.delete(platform)
        session.commit()

        return {'message': 'Platform deleted successfully'}

    except HTTPException:
        raise
    except Exception as e:
        print(f'Error deleting platform: {e}')
        raise HTTPException(status_code=500, detail='Failed to delete platform')
