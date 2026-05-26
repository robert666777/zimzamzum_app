from typing import Optional
from pydantic import BaseModel


class UserBase(BaseModel):
    name: str
    email: Optional[str] = None


class UserAuth(BaseModel):
    email: Optional[str] = None
    phone_number: Optional[str] = None
    password: str
    login_session_type: str = 'windows'


class UserCreate(UserBase):
    password: str
    phone_number: Optional[str] = None
    login_session_type: str = 'windows'
    referral_code: Optional[str] = None


class UserInfo(UserBase):
    id: str
    image: Optional[str] = None
    is_email_verified: bool
    phone_number: Optional[str] = None


class Logout(BaseModel):
    access_token: str


class RefreshToken(BaseModel):
    refresh_token: str


class LoginWithGoogle(BaseModel):
    code: str
    code_verifier: str
    login_session_type: str = 'windows'
    referral_code: Optional[str] = None


class SendSmsCode(BaseModel):
    phone_number: str


class PhoneLogin(BaseModel):
    phone_number: str
    verification_code: str
    login_session_type: str = 'windows'


class PhoneSignup(BaseModel):
    phone_number: str
    verification_code: str
    name: str
    login_session_type: str = 'windows'
    referral_code: Optional[str] = None
