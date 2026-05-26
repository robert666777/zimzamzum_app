from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select
from db.models import User, UserType, LoginSession, PhoneVerificationEntry
from schemas.auth import UserInfo, UserCreate, UserAuth, Logout, RefreshToken, LoginWithGoogle, PhoneLogin, PhoneSignup, SendSmsCode
from db.database import get_session
from utils.security import verify_password, hash_password
from utils.referral_helpers import generate_unique_referral_code, normalize_referral_code, add_referral_reward_day
from utils.auth_helper import create_login_session, create_token_from_user, decode_token, is_session_valid
from utils.sms_helper import send_sms_verification_code
import datetime
from utils import constants
from utils.procedures import CustomError
from dependencies.auth_dependencies import get_current_user_dependency
import os
import requests


router = APIRouter(prefix='/apps/auth', tags=['auth'])


@router.post('/login')
def login_with_email_or_phone(user_auth: UserAuth, db: Session = Depends(get_session)):
    user = None

    if user_auth.email:
        query = select(User).where(User.email == user_auth.email)
        user = db.exec(query).first()
    elif user_auth.phone_number:
        query = select(User).where(User.phone_number == user_auth.phone_number)
        user = db.exec(query).first()

    if not user or not user.password or not verify_password(user_auth.password, user.password) or user.user_type != UserType.NORMAL_USER:
        raise CustomError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message='Invalid email/phone or password.'
        )

    if user.is_blocked:
        raise CustomError(
            status_code=status.HTTP_403_FORBIDDEN,
            message='Forbidden.'
        )

    exp = datetime.datetime.now(datetime.UTC) + constants.ACCESS_TOKEN_LIFETIME_DELTA
    login_session = create_login_session(user, db, exp, user_auth.login_session_type)
    token, refresh_token = create_token_from_user(user, exp, login_session.id)

    user_data = UserInfo(
        id=user.id,
        name=user.name,
        email=user.email,
        image=user.image,
        is_email_verified=user.is_email_verified,
        phone_number=user.phone_number,
    )

    return {
        'token': token,
        'refresh_token': refresh_token,
        'user': user_data,
    }


@router.post('/login_google_desktop')
def login_with_google_desktop(login_google_obj: LoginWithGoogle, db: Session = Depends(get_session)):
    try:
        token_res = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": login_google_obj.code,
                "client_id": os.getenv("GOOGLE_LOGIN_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_LOGIN_CLIENT_SECRET"),
                "redirect_uri": os.getenv("GOOGLE_LOGIN_DESKTOP_REDIRECT_URI"),
                "grant_type": "authorization_code",
                "code_verifier": login_google_obj.code_verifier,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        if token_res.status_code != 200:
            raise CustomError(401, "Failed to exchange token")

        tokens = token_res.json()
        access_token = tokens["access_token"]

        response = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'}
        )

        if response.status_code != status.HTTP_200_OK:
            raise CustomError(status.HTTP_401_UNAUTHORIZED, 'Invalid_Google_Token')

        google_user = response.json()

        sub = google_user['sub']
        name = google_user['name']
        email = google_user['email']

        user = db.exec(select(User).where(User.google_user_id == sub)).first()
        if not user:
            user = db.exec(select(User).where(User.email == email)).first()
            if user:
                user.google_user_id = sub
                user.google_token = access_token
                user.is_email_verified = True

                db.add(user)
                db.commit()
                db.refresh(user)
            else:
                user = User(
                    name=name,
                    email=email,
                    google_user_id=sub,
                    google_token=access_token,
                    is_email_verified=True
                )
                db.add(user)
                db.flush()
                user.referral_code = generate_unique_referral_code(db)
                ref_input = normalize_referral_code(login_google_obj.referral_code)
                if ref_input:
                    referrer = db.exec(select(User).where(User.referral_code == ref_input)).first()
                    if referrer and referrer.id != user.id:
                        user.referred_by_user_id = referrer.id
                        add_referral_reward_day(referrer, db)
                db.commit()
                db.refresh(user)

        exp = datetime.datetime.now(datetime.UTC) + constants.ACCESS_TOKEN_LIFETIME_DELTA
        login_session = create_login_session(user, db, exp, login_google_obj.login_session_type)
        token, refresh_token = create_token_from_user(user, exp, login_session.id)

        user_data = UserInfo(
            id=user.id,
            name=user.name,
            email=user.email,
            image=user.image,
            is_email_verified=user.is_email_verified,
        )

        return {
            'token': token,
            'refresh_token': refresh_token,
            'user': user_data,
        }

    except Exception:
        raise CustomError(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Error')


@router.get('/user_info')
def user_info(db: Session = Depends(get_session), user: User = Depends(get_current_user_dependency)):
    user_data = UserInfo(
        id=user.id,
        name=user.name,
        email=user.email,
        image=user.image,
        is_email_verified=user.is_email_verified,
        phone_number=user.phone_number,
    )

    return user_data


@router.post('/signup')
def signup(user_create: UserCreate, db: Session = Depends(get_session)):
    existing_user = None

    if user_create.email:
        existing_user = db.exec(select(User).where(User.email == user_create.email)).first()
        if existing_user:
            raise CustomError(
                status_code=status.HTTP_400_BAD_REQUEST,
                message='Email already registered'
            )
    elif user_create.phone_number:
        existing_user = db.exec(select(User).where(User.phone_number == user_create.phone_number)).first()
        if existing_user:
            raise CustomError(
                status_code=status.HTTP_400_BAD_REQUEST,
                message='Phone number already registered'
            )

    hashed_password = hash_password(user_create.password)
    
    email_to_use = user_create.email if user_create.email else f'{user_create.phone_number}@neuralagent.app'
    
    new_user = User(
        name=user_create.name,
        email=email_to_use,
        phone_number=user_create.phone_number,
        password=hashed_password,
    )
    db.add(new_user)
    db.flush()

    new_user.referral_code = generate_unique_referral_code(db)

    ref_input = normalize_referral_code(user_create.referral_code)
    if ref_input:
        referrer = db.exec(select(User).where(User.referral_code == ref_input)).first()
        if referrer and referrer.id != new_user.id:
            new_user.referred_by_user_id = referrer.id
            add_referral_reward_day(referrer, db)

    db.commit()
    db.refresh(new_user)

    exp = datetime.datetime.now(datetime.UTC) + constants.ACCESS_TOKEN_LIFETIME_DELTA
    login_session = create_login_session(new_user, db, exp, user_create.login_session_type)
    token, refresh_token = create_token_from_user(new_user, exp, login_session.id)

    user_data = UserInfo(
        id=new_user.id,
        name=new_user.name,
        email=new_user.email,
        image=new_user.image,
        is_email_verified=new_user.is_email_verified,
        phone_number=new_user.phone_number,
    )

    # TODO Send Email Verification

    return {
        'token': token,
        'refresh_token': refresh_token,
        'user': user_data,
    }


@router.post('/logout')
def logout(logout_obj: Logout, db: Session = Depends(get_session)):
    payload = decode_token(logout_obj.access_token)

    if payload.get('token_type') != 'access':
        raise CustomError(status.HTTP_400_BAD_REQUEST, 'Invalid_Token')

    if not is_session_valid(payload.get('session_id'), db):
        raise CustomError(status.HTTP_401_UNAUTHORIZED, 'Invalid_Token')

    query = select(LoginSession).where(LoginSession.id == payload.get('session_id'))
    login_session = db.exec(query).first()

    login_session.is_logged_out = True
    db.add(login_session)
    db.commit()
    db.refresh(login_session)

    return {
        'message': 'Success'
    }


@router.post('/refresh_token')
def refresh_current_token(refresh_obj: RefreshToken, db: Session = Depends(get_session)):
    payload = decode_token(refresh_obj.refresh_token)

    if payload.get('token_type') != 'refresh':
        raise CustomError(status.HTTP_400_BAD_REQUEST, 'Invalid_Token')

    if not is_session_valid(payload.get('session_id'), db):
        raise CustomError(status.HTTP_401_UNAUTHORIZED, 'Invalid_Token')

    u_query = select(User).where(User.id == payload.get('user_id'))
    user = db.exec(u_query).first()

    if not user:
        raise CustomError(status_code=status.HTTP_401_UNAUTHORIZED, message='Invalid_Token')

    s_query = select(LoginSession).where(LoginSession.id == payload.get('session_id'))
    login_session = db.exec(s_query).first()

    exp = payload.get('exp')
    dif = datetime.datetime.fromtimestamp(exp) - datetime.datetime.now()
    with_refresh = dif <= datetime.timedelta(hours=1)

    exp = datetime.datetime.now(datetime.UTC) + constants.ACCESS_TOKEN_LIFETIME_DELTA

    new_token, new_refresh = create_token_from_user(user, exp, login_session.id, with_refresh)

    login_session.expires_at = exp
    if with_refresh:
        login_session.refresh_expires_at = datetime.datetime.now(datetime.UTC) + constants.REFRESH_TOKEN_LIFETIME_DELTA

    db.add(login_session)
    db.commit()
    db.refresh(login_session)

    return {
        'new_token': new_token,
        'new_refresh': new_refresh
    }


@router.post('/send_sms_code')
def send_sms_code(sms_code_obj: SendSmsCode, db: Session = Depends(get_session)):
    phone_number = sms_code_obj.phone_number
    
    if len(phone_number) < 10:
        raise CustomError(status.HTTP_400_BAD_REQUEST, 'Invalid phone number')

    expires_at = datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=5)
    
    existing_entry = db.exec(
        select(PhoneVerificationEntry).where(PhoneVerificationEntry.phone_number == phone_number)
    ).first()
    
    if existing_entry:
        db.delete(existing_entry)
        db.commit()

    new_entry = PhoneVerificationEntry(
        phone_number=phone_number,
        expires_at=expires_at
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    verification_code = new_entry.verification_code
    
    send_sms_verification_code(phone_number, verification_code)

    return {'message': 'Verification code sent'}


@router.post('/login_with_sms')
def login_with_sms(phone_login: PhoneLogin, db: Session = Depends(get_session)):
    phone_number = phone_login.phone_number
    verification_code = phone_login.verification_code

    entry = db.exec(
        select(PhoneVerificationEntry).where(
            PhoneVerificationEntry.phone_number == phone_number,
            PhoneVerificationEntry.verification_code == verification_code,
            PhoneVerificationEntry.is_used == False,
            PhoneVerificationEntry.expires_at > datetime.datetime.now(datetime.UTC)
        )
    ).first()

    if not entry:
        raise CustomError(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired verification code')

    entry.is_used = True
    db.add(entry)
    db.commit()

    user = db.exec(select(User).where(User.phone_number == phone_number)).first()

    if not user:
        raise CustomError(status.HTTP_404_NOT_FOUND, 'User not found')

    if user.is_blocked:
        raise CustomError(status.HTTP_403_FORBIDDEN, 'Forbidden')

    exp = datetime.datetime.now(datetime.UTC) + constants.ACCESS_TOKEN_LIFETIME_DELTA
    login_session = create_login_session(user, db, exp, phone_login.login_session_type)
    token, refresh_token = create_token_from_user(user, exp, login_session.id)

    user_data = UserInfo(
        id=user.id,
        name=user.name,
        email=user.email,
        image=user.image,
        is_email_verified=user.is_email_verified,
        phone_number=user.phone_number,
    )

    return {
        'token': token,
        'refresh_token': refresh_token,
        'user': user_data,
    }


@router.post('/signup_with_sms')
def signup_with_sms(phone_signup: PhoneSignup, db: Session = Depends(get_session)):
    phone_number = phone_signup.phone_number
    verification_code = phone_signup.verification_code
    name = phone_signup.name

    entry = db.exec(
        select(PhoneVerificationEntry).where(
            PhoneVerificationEntry.phone_number == phone_number,
            PhoneVerificationEntry.verification_code == verification_code,
            PhoneVerificationEntry.is_used == False,
            PhoneVerificationEntry.expires_at > datetime.datetime.now(datetime.UTC)
        )
    ).first()

    if not entry:
        raise CustomError(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired verification code')

    entry.is_used = True
    db.add(entry)
    db.commit()

    existing_user = db.exec(select(User).where(User.phone_number == phone_number)).first()
    if existing_user:
        raise CustomError(status.HTTP_400_BAD_REQUEST, 'Phone number already registered')

    new_user = User(
        name=name,
        email=f'{phone_number}@neuralagent.app',
        phone_number=phone_number,
    )
    db.add(new_user)
    db.flush()

    new_user.referral_code = generate_unique_referral_code(db)

    ref_input = normalize_referral_code(phone_signup.referral_code)
    if ref_input:
        referrer = db.exec(select(User).where(User.referral_code == ref_input)).first()
        if referrer and referrer.id != new_user.id:
            new_user.referred_by_user_id = referrer.id
            add_referral_reward_day(referrer, db)

    db.commit()
    db.refresh(new_user)

    exp = datetime.datetime.now(datetime.UTC) + constants.ACCESS_TOKEN_LIFETIME_DELTA
    login_session = create_login_session(new_user, db, exp, phone_signup.login_session_type)
    token, refresh_token = create_token_from_user(new_user, exp, login_session.id)

    user_data = UserInfo(
        id=new_user.id,
        name=new_user.name,
        email=new_user.email,
        image=new_user.image,
        is_email_verified=new_user.is_email_verified,
        phone_number=new_user.phone_number,
    )

    return {
        'token': token,
        'refresh_token': refresh_token,
        'user': user_data,
    }
