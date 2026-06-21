from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from db.database import get_session
from db.models import Plan, UserPlan, PaymentRequest, PaymentRequestStatus, User
from dependencies.auth_dependencies import get_current_user_dependency
from typing import List
import datetime
DAILY_FREE_MINUTES = 10

router = APIRouter(prefix="/apps/payments")


# --- Plan Endpoints ---

@router.get("/plans", response_model=List[Plan])
async def get_plans(session: Session = Depends(get_session)):
    """Get all available plans"""
    plans = session.exec(select(Plan)).all()
    return plans


@router.get("/user/plan")
async def get_user_plan(
    current_user: User = Depends(get_current_user_dependency),
    session: Session = Depends(get_session)
):
    """Get current user's active plan"""
    user_plan = session.exec(
        select(UserPlan)
        .where(UserPlan.user_id == current_user.id)
        .where(UserPlan.is_active == True)
        .order_by(UserPlan.created_at.desc())
    ).first()
    
    # Check if the plan has expired (only for non-free plans)
    if user_plan and user_plan.plan_id != 'free':
        # Convertir les dates en UTC naive pour une comparaison correcte
        now = datetime.datetime.now()
        expires_at = user_plan.expires_at
        
        # Si expires_at a un timezone, le convertir en naive
        if expires_at and expires_at.tzinfo is not None:
            expires_at = expires_at.replace(tzinfo=None)
        
        if expires_at and expires_at < now:
            # Plan expired - deactivate it and create a free plan
            user_plan.is_active = False
            
            # Create new free plan
            free_plan = UserPlan(
                user_id=current_user.id,
                plan_id='free',
                is_trial=False,
                started_at=datetime.datetime.now(),
                expires_at=None,  # Free plan doesn't expire
                is_active=True
            )
            session.add(free_plan)
            session.commit()
            session.refresh(free_plan)
            
            # Return the NEW free plan (not the expired one)
            user_plan = free_plan
            
            plan = session.exec(select(Plan).where(Plan.id == 'free')).first()
            
            return {
                "plan_id": user_plan.plan_id,
                "plan": plan,
                "is_trial": user_plan.is_trial,
                "started_at": user_plan.started_at,
                "expires_at": user_plan.expires_at,
                "is_active": user_plan.is_active,
                "daily_free_minutes": DAILY_FREE_MINUTES,
                "plan_just_expired": True  # Flag to tell frontend to show expiration message
            }
    
    # If no plan, create free plan (no trial anymore)
    if not user_plan:
        free_plan = session.exec(select(Plan).where(Plan.id == 'free')).first()
        
        user_plan = UserPlan(
            user_id=current_user.id,
            plan_id='free',
            is_trial=False,  # Plus de free trial
            started_at=datetime.datetime.now(),
            expires_at=None,  # Le free plan n'expire plus
            is_active=True
        )
        session.add(user_plan)
        session.commit()
        session.refresh(user_plan)
    
    plan = session.exec(select(Plan).where(Plan.id == user_plan.plan_id)).first()
    
    return {
        "plan_id": user_plan.plan_id,
        "plan": plan,
        "is_trial": user_plan.is_trial,
        "started_at": user_plan.started_at,
        "expires_at": user_plan.expires_at,
        "is_active": user_plan.is_active,
        "daily_free_minutes": DAILY_FREE_MINUTES
    }


# --- Payment Request Endpoints ---

@router.post("/payment-request")
async def create_payment_request(
    request_data: dict,
    current_user: User = Depends(get_current_user_dependency),
    session: Session = Depends(get_session)
):
    """Create a payment request for plan upgrade"""
    plan_id = request_data.get("plan_id")
    payment_method = request_data.get("payment_method")
    
    if not plan_id or not payment_method:
        raise HTTPException(status_code=400, detail="plan_id and payment_method are required")
    
    plan = session.exec(select(Plan).where(Plan.id == plan_id)).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    payment_request = PaymentRequest(
        user_id=current_user.id,
        user_name=current_user.name,
        plan_id=plan_id,
        amount=plan.price,
        payment_method=payment_method
    )
    session.add(payment_request)
    session.commit()
    session.refresh(payment_request)
    
    return payment_request


@router.get("/payment-requests")
async def get_user_payment_requests(
    current_user: User = Depends(get_current_user_dependency),
    session: Session = Depends(get_session)
):
    """Get all payment requests for current user"""
    requests = session.exec(
        select(PaymentRequest)
        .where(PaymentRequest.user_id == current_user.id)
        .order_by(PaymentRequest.created_at.desc())
    ).all()
    return requests


# --- Admin Endpoints ---

@router.get("/admin/payment-requests")
async def get_all_payment_requests(
    current_user: User = Depends(get_current_user_dependency),
    session: Session = Depends(get_session)
):
    """Admin: Get all pending payment requests"""
    user = session.exec(select(User).where(User.id == current_user.id)).first()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    requests = session.exec(
        select(PaymentRequest)
        .order_by(PaymentRequest.created_at.desc())
    ).all()
    
    # Attach plan info
    result = []
    for req in requests:
        plan = session.exec(select(Plan).where(Plan.id == req.plan_id)).first()
        result.append({
            **req.model_dump(),
            "plan": plan.model_dump() if plan else None
        })
    
    return result


@router.post("/admin/approve-payment/{payment_id}")
async def approve_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user_dependency),
    session: Session = Depends(get_session)
):
    """Admin: Approve a payment request and upgrade user's plan"""
    user = session.exec(select(User).where(User.id == current_user.id)).first()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payment_request = session.exec(select(PaymentRequest).where(PaymentRequest.id == payment_id)).first()
    if not payment_request:
        raise HTTPException(status_code=404, detail="Payment request not found")
    
    # Deactivate current user plans
    current_user_plans = session.exec(
        select(UserPlan)
        .where(UserPlan.user_id == payment_request.user_id)
    ).all()
    for up in current_user_plans:
        up.is_active = False
    
    # Create new plan
    plan = session.exec(select(Plan).where(Plan.id == payment_request.plan_id)).first()
    
    expires_at = None
    if plan.period_days:
        expires_at = datetime.datetime.now() + datetime.timedelta(days=plan.period_days)
    
    new_user_plan = UserPlan(
        user_id=payment_request.user_id,
        plan_id=plan.id,
        is_trial=False,
        started_at=datetime.datetime.now(),
        expires_at=expires_at,
        is_active=True
    )
    session.add(new_user_plan)
    
    # Update payment request
    payment_request.status = PaymentRequestStatus.APPROVED
    payment_request.confirmed_at = datetime.datetime.now()
    payment_request.confirmed_by = current_user.id
    
    session.commit()
    
    return {
        "success": True,
        "payment_request": payment_request,
        "new_plan": new_user_plan
    }


@router.post("/admin/reject-payment/{payment_id}")
async def reject_payment(
    payment_id: int,
    admin_notes: str = "",
    current_user: User = Depends(get_current_user_dependency),
    session: Session = Depends(get_session)
):
    """Admin: Reject a payment request"""
    user = session.exec(select(User).where(User.id == current_user.id)).first()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payment_request = session.exec(select(PaymentRequest).where(PaymentRequest.id == payment_id)).first()
    if not payment_request:
        raise HTTPException(status_code=404, detail="Payment request not found")
    
    payment_request.status = PaymentRequestStatus.REJECTED
    payment_request.admin_notes = admin_notes
    
    session.commit()
    session.refresh(payment_request)
    
    return payment_request
