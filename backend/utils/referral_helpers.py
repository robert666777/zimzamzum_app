import datetime
import secrets
import string
from sqlmodel import Session, select, func

from db.models import User

_REFERRAL_ALPHABET = string.ascii_uppercase + string.digits
_CODE_LEN = 8
_REFERRALS_PER_REWARD = 7  # 7 referrals = 1 day free


def generate_unique_referral_code(session: Session) -> str:
    for _ in range(80):
        code = ''.join(secrets.choice(_REFERRAL_ALPHABET) for _ in range(_CODE_LEN))
        exists = session.exec(select(User).where(User.referral_code == code)).first()
        if not exists:
            return code
    raise RuntimeError('Could not generate referral code')


def normalize_referral_code(raw: str | None) -> str | None:
    if not raw:
        return None
    s = ''.join(c for c in raw.strip().upper() if c.isalnum())
    if len(s) < _CODE_LEN:
        return None
    return s[:_CODE_LEN]


def add_referral_reward_day(referrer: User, session: Session):
    """Extend referrer's complimentary access by 1 day when they have 7 referrals."""
    # Count how many people this referrer has referred
    referral_count = session.exec(
        select(func.count(User.id)).where(User.referred_by_user_id == referrer.id)
    ).one()
    
    # Only add a day if they have reached a multiple of 7 referrals
    if referral_count > 0 and referral_count % _REFERRALS_PER_REWARD == 0:
        now = datetime.datetime.now(datetime.UTC)
        current_end = referrer.referral_reward_until
        if current_end is not None:
            if current_end.tzinfo is None:
                current_end = current_end.replace(tzinfo=datetime.UTC)
            base = max(now, current_end)
        else:
            base = now
        referrer.referral_reward_until = base + datetime.timedelta(days=1)
        session.add(referrer)


def mask_email(email: str) -> str:
    if not email or '@' not in email:
        return '***'
    local, _, domain = email.partition('@')
    if len(local) <= 1:
        masked_local = '*'
    else:
        masked_local = local[0] + '*' * min(4, len(local) - 1) + local[-1]
    return f'{masked_local}@{domain}'


def mask_name(name: str) -> str:
    if not name or len(name) <= 1:
        return '***'
    return name[0] + '*' * 3 + name[-1]
