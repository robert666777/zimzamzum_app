import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from db.database import get_session
from db.models import User
from dependencies.auth_dependencies import get_current_user_dependency
from utils.referral_helpers import mask_email, mask_name, generate_unique_referral_code

router = APIRouter(
    prefix='/apps/referrals',
    tags=['referrals'],
    dependencies=[Depends(get_current_user_dependency)],
)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


@router.get('/summary')
def referral_summary(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user_dependency),
):
    if not user.referral_code:
        user.referral_code = generate_unique_referral_code(db)
        db.add(user)
        db.commit()
        db.refresh(user)

    referred_rows = db.exec(
        select(User)
        .where(User.referred_by_user_id == user.id)
        .order_by(User.created_at.desc())
    ).all()

    referral_count = len(referred_rows)
    
    # Calculer les nouveaux jours de récompense
    REFERRALS_PER_REWARD = 30
    last_count = user.last_referral_reward_count or 0
    new_reward_days = (referral_count // REFERRALS_PER_REWARD) - (last_count // REFERRALS_PER_REWARD)
    
    # Mettre à jour le last_count si on a des nouveaux jours
    if new_reward_days > 0:
        user.last_referral_reward_count = referral_count
        db.add(user)
        db.commit()

    referred = [
        {
            'id': r.id,
            'name_masked': mask_name(r.name),
            'joined_at': _iso(r.created_at),
        }
        for r in referred_rows
    ]

    base = os.getenv('REFERRAL_PUBLIC_SIGNUP_URL', 'https://www.zimzamzum.site').rstrip('/')
    share_url = f'{base}/signup?ref={user.referral_code}'

    return {
        'referral_code': user.referral_code,
        'referral_count': int(referral_count),
        'referral_reward_until': _iso(user.referral_reward_until),
        'share_url': share_url,
        'referred': referred,
        'new_reward_days': int(new_reward_days),
    }
